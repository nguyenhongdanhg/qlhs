import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetPasswordRequest {
  user_ids: string[];
  new_password?: string;
  passwords?: Record<string, string>; // per-user override: user_id -> password
  school_id: string;
}

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

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the calling user using getClaims with the token
    const { data, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !data?.claims) {
      console.error('Invalid token:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = data.claims.sub as string;
    console.log('Caller user ID:', callerUserId);

    // Parse request body
    const body: ResetPasswordRequest = await req.json();
    
    if (!body.user_ids || body.user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No users specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.new_password || body.new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Resetting password for', body.user_ids.length, 'users');

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
          JSON.stringify({ error: 'Only school admins can reset passwords' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Reset passwords for each user
    const results: { user_id: string; success: boolean; error?: string }[] = [];

    for (const userId of body.user_ids) {
      try {
        // Verify user belongs to this school (unless super admin)
        if (!isSuperAdmin) {
          const { data: userMembership } = await adminClient
            .from('school_memberships')
            .select('id')
            .eq('user_id', userId)
            .eq('school_id', body.school_id)
            .maybeSingle();

          if (!userMembership) {
            results.push({ user_id: userId, success: false, error: 'User not in school' });
            continue;
          }
        }

        // Update password using Admin API
        const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
          password: body.new_password,
        });

        if (updateError) {
          console.error('Error updating password for', userId, ':', updateError);
          results.push({ user_id: userId, success: false, error: updateError.message });
        } else {
          console.log('Password reset for user:', userId);
          results.push({ user_id: userId, success: true });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error processing user', userId, ':', err);
        results.push({ user_id: userId, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('Reset complete:', successCount, 'success,', failCount, 'failed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          total: body.user_ids.length,
          success: successCount,
          failed: failCount,
        }
      }),
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
