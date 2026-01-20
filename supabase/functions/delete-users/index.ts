import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUsersRequest {
  user_ids: string[];
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
    const body: DeleteUsersRequest = await req.json();
    
    if (!body.user_ids || body.user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deleting users:', body.user_ids.length);

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
          JSON.stringify({ error: 'Only school admins can delete users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prevent deleting self
    if (body.user_ids.includes(callerUserId)) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failCount = 0;
    const failedUsers: string[] = [];

    for (const userId of body.user_ids) {
      try {
        // First, delete the school membership
        const { error: membershipError } = await adminClient
          .from('school_memberships')
          .delete()
          .eq('user_id', userId)
          .eq('school_id', body.school_id);

        if (membershipError) {
          console.error('Error deleting membership:', userId, membershipError);
          failedUsers.push(userId);
          failCount++;
          continue;
        }

        // Check if user has any other school memberships
        const { data: otherMemberships } = await adminClient
          .from('school_memberships')
          .select('id')
          .eq('user_id', userId);

        // If no other memberships, delete the user completely
        if (!otherMemberships || otherMemberships.length === 0) {
          // Delete from user_permission_groups
          await adminClient
            .from('user_permission_groups')
            .delete()
            .eq('user_id', userId);

          // Delete from user_permissions
          await adminClient
            .from('user_permissions')
            .delete()
            .eq('user_id', userId);

          // Delete profile
          await adminClient
            .from('profiles')
            .delete()
            .eq('id', userId);

          // Delete the auth user
          const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
          
          if (deleteUserError) {
            console.error('Error deleting auth user:', userId, deleteUserError);
            // User was removed from school but not completely deleted
          }
        }

        successCount++;
        console.log('Deleted user:', userId);

      } catch (error) {
        console.error('Error deleting user:', userId, error);
        failedUsers.push(userId);
        failCount++;
      }
    }

    console.log(`Delete complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: successCount, 
        failed: failCount,
        failedUsers 
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
