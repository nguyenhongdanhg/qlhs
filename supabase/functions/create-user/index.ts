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
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@phone.local`;
};

// Helper to ensure profile exists and create membership
async function ensureProfileAndMembership(
  adminClient: any,
  userId: string,
  body: CreateUserRequest,
  userEmail: string
) {
  // Check if profile exists, if not re-create it
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!existingProfile) {
    console.log('Profile missing for user, re-creating:', userId);
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: userId,
        full_name: body.full_name,
        phone: body.phone || null,
        username: body.phone || userEmail.split('@')[0],
      });
    if (profileError) {
      console.error('Error re-creating profile:', profileError);
    }
  } else {
    // Update profile with latest info
    if (body.phone) {
      await adminClient
        .from('profiles')
        .update({
          full_name: body.full_name,
          phone: body.phone,
          username: body.phone,
        })
        .eq('id', userId);
    }
  }

  // Check if already has membership in this school
  const { data: existingMembership } = await adminClient
    .from('school_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('school_id', body.school_id)
    .maybeSingle();

  if (existingMembership) {
    return { success: true, user_id: userId, existing: true, code: 'USER_EXISTS' };
  }

  // Add membership
  const { error: membershipError } = await adminClient
    .from('school_memberships')
    .insert({
      school_id: body.school_id,
      user_id: userId,
      role: body.role,
      class_id: body.class_id || null,
      status: 'active',
    });

  if (membershipError) {
    console.error('Error creating membership:', membershipError);
    return { error: membershipError.message };
  }

  return { success: true, user_id: userId, existing: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const token = authHeader.replace('Bearer ', '');
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Invalid token:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = claimsData.claims.sub as string;
    console.log('Caller user ID:', callerUserId);

    const body: CreateUserRequest = await req.json();
    
    let userEmail: string;
    if (body.phone) {
      userEmail = phoneToEmail(body.phone);
    } else if (body.email) {
      userEmail = body.email;
    } else {
      return new Response(
        JSON.stringify({ error: 'Email or phone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Creating user:', { email: userEmail, full_name: body.full_name, role: body.role, phone: body.phone });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if super admin
    const { data: globalRole } = await adminClient
      .from('global_roles')
      .select('role')
      .eq('user_id', callerUserId)
      .maybeSingle();
    
    const isSuperAdmin = globalRole?.role === 'super_admin';
    
    if (!isSuperAdmin) {
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

    // Try to create new user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: userEmail,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        username: body.phone || userEmail.split('@')[0],
      },
    });

    // Handle case where user already exists in auth
    if (createError) {
      const errorMessage = createError.message || '';
      
      if (errorMessage.includes('already been registered') || errorMessage.includes('already exists')) {
        console.log('User already exists, looking up by email:', userEmail);
        
        // Find the existing auth user
        const { data: usersData } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        
        const existingUser = usersData?.users?.find(u => u.email === userEmail);
        
        if (existingUser) {
          console.log('Found existing auth user:', existingUser.id);
          // Ensure profile + membership exist (handles re-creation after deletion)
          const result = await ensureProfileAndMembership(adminClient, existingUser.id, body, userEmail);
          
          if (result.error) {
            return new Response(
              JSON.stringify({ error: result.error }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Auth says exists but can't find - try by phone in profiles
        if (body.phone) {
          const { data: profile } = await adminClient
            .from('profiles')
            .select('id')
            .eq('phone', body.phone)
            .maybeSingle();
          
          if (profile) {
            const result = await ensureProfileAndMembership(adminClient, profile.id, body, userEmail);
            if (result.error) {
              return new Response(
                JSON.stringify({ error: result.error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            return new Response(
              JSON.stringify(result),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        console.error('Could not find existing user by email or phone');
        return new Response(
          JSON.stringify({ error: 'User exists but could not be found', code: 'USER_EXISTS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
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
