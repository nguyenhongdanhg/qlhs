import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email?: string;
  password: string;
  full_name: string;
  phone?: string;
  school_id: string;
  role: string;
  class_id?: string | null;
}

// Helper to convert phone to email format for Supabase auth
const phoneToEmail = (phone: string) => {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@phone.local`;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase client with user token to verify caller
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the calling user using getUser
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = user.id;
    console.log('Caller user ID:', callerUserId);

    // Parse request body
    const body: CreateUserRequest = await req.json();
    
    // Determine email - use provided email or convert phone to email
    const userEmail = body.email || (body.phone ? phoneToEmail(body.phone) : '');
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'Email or phone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Creating user:', { email: userEmail, full_name: body.full_name, role: body.role, phone: body.phone });

    // Verify caller is admin of the school or super admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if super admin
    const { data: globalRole } = await adminClient
      .from('global_roles')
      .select('role')
      .eq('user_id', callerUserId)
      .maybeSingle();
    
    const isSuperAdmin = globalRole?.role === 'super_admin';
    
    if (!isSuperAdmin) {
      // Check if school admin
      const { data: membership } = await adminClient
        .from('school_memberships')
        .select('role')
        .eq('user_id', callerUserId)
        .eq('school_id', body.school_id)
        .eq('status', 'active')
        .maybeSingle();

      if (membership?.role !== 'admin') {
        console.error('User is not admin:', callerUserId);
        return new Response(
          JSON.stringify({ error: 'Only school admins can create users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Try to create new user first using Admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: userEmail,
      password: body.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: body.full_name,
        username: body.phone || userEmail.split('@')[0],
      },
    });

    // Handle case where user already exists
    if (createError) {
      const errorMessage = createError.message || '';
      
      // Check if error is "user already exists"
      if (errorMessage.includes('already been registered') || errorMessage.includes('already exists')) {
        console.log('User already exists, looking up by email:', userEmail);
        
        // Find the existing user using listUsers with filter
        const { data: usersData } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        
        const existingUser = usersData?.users?.find(u => u.email === userEmail);
        
        if (!existingUser) {
          // Try to find in profiles by phone
          const { data: profile } = await adminClient
            .from('profiles')
            .select('id')
            .eq('phone', body.phone)
            .maybeSingle();
          
          if (profile) {
            // Check if already has membership in this school
            const { data: existingMembership } = await adminClient
              .from('school_memberships')
              .select('id')
              .eq('user_id', profile.id)
              .eq('school_id', body.school_id)
              .maybeSingle();

            if (existingMembership) {
              return new Response(
                JSON.stringify({ success: true, user_id: profile.id, existing: true, code: 'USER_EXISTS' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            // Add membership for existing user
            const { error: membershipError } = await adminClient
              .from('school_memberships')
              .insert({
                school_id: body.school_id,
                user_id: profile.id,
                role: body.role,
                class_id: body.class_id || null,
                status: 'active',
              });

            if (membershipError) {
              console.error('Error creating membership:', membershipError);
              return new Response(
                JSON.stringify({ error: membershipError.message }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            return new Response(
              JSON.stringify({ success: true, user_id: profile.id, existing: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          console.error('Could not find existing user');
          return new Response(
            JSON.stringify({ error: 'User exists but could not be found', code: 'USER_EXISTS' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Found existing user:', existingUser.id);
        
        // Check if already has membership in this school
        const { data: existingMembership } = await adminClient
          .from('school_memberships')
          .select('id')
          .eq('user_id', existingUser.id)
          .eq('school_id', body.school_id)
          .maybeSingle();

        if (existingMembership) {
          return new Response(
            JSON.stringify({ success: true, user_id: existingUser.id, existing: true, code: 'USER_EXISTS' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Add membership for existing user
        const { error: membershipError } = await adminClient
          .from('school_memberships')
          .insert({
            school_id: body.school_id,
            user_id: existingUser.id,
            role: body.role,
            class_id: body.class_id || null,
            status: 'active',
          });

        if (membershipError) {
          console.error('Error creating membership:', membershipError);
          return new Response(
            JSON.stringify({ error: membershipError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update profile with phone if needed
        if (body.phone) {
          await adminClient
            .from('profiles')
            .update({
              phone: body.phone,
              username: body.phone,
            })
            .eq('id', existingUser.id);
        }

        return new Response(
          JSON.stringify({ success: true, user_id: existingUser.id, existing: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Other create error
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created:', newUser.user.id);

    // Update profile with phone
    if (body.phone) {
      await adminClient
        .from('profiles')
        .update({
          phone: body.phone,
          username: body.phone,
        })
        .eq('id', newUser.user.id);
    }

    // Create school membership
    const { error: membershipError } = await adminClient
      .from('school_memberships')
      .insert({
        school_id: body.school_id,
        user_id: newUser.user.id,
        role: body.role,
        class_id: body.class_id || null,
        status: 'active',
      });

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      // User was created but membership failed - still return success with warning
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: newUser.user.id, 
          warning: 'User created but membership failed: ' + membershipError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User and membership created successfully');

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
