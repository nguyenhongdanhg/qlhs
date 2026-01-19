import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Helper function to get or create user
    async function getOrCreateUser(email: string, password: string, fullName: string, username: string, phone: string) {
      // Check if user exists by listing users
      const { data: userList } = await supabase.auth.admin.listUsers();
      const existingUser = userList?.users?.find(u => u.email === email);
      
      if (existingUser) {
        console.log(`User ${email} already exists:`, existingUser.id);
        // Update profile
        await supabase
          .from("profiles")
          .update({ full_name: fullName, username, phone })
          .eq("id", existingUser.id);
        return existingUser.id;
      }

      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });
      
      if (error) throw error;
      console.log(`Created user ${email}:`, newUser.user.id);
      
      // Update profile
      await supabase
        .from("profiles")
        .update({ username, phone })
        .eq("id", newUser.user.id);
      
      return newUser.user.id;
    }

    // 1. Get or Create School
    let school;
    const { data: existingSchool } = await supabase
      .from("schools")
      .select()
      .eq("code", "thpt-nguyen-trai")
      .single();

    if (existingSchool) {
      school = existingSchool;
      console.log("School already exists:", school.id);
    } else {
      const { data: newSchool, error: schoolError } = await supabase
        .from("schools")
        .insert({
          code: "thpt-nguyen-trai",
          name: "THPT Nguyễn Trãi",
          address: "123 Đường Nguyễn Trãi, Quận 1, TP.HCM",
          phone: "028-1234-5678",
          email: "contact@thptnguyen-trai.edu.vn",
          is_active: true
        })
        .select()
        .single();
      if (schoolError) throw schoolError;
      school = newSchool;
      console.log("Created school:", school.id);
    }

    // 2. Create Super Admin
    const superAdminId = await getOrCreateUser(
      "superadmin@test.com",
      "SuperAdmin123!",
      "Super Administrator",
      "superadmin",
      "0901234567"
    );

    // Ensure global_roles entry
    await supabase
      .from("global_roles")
      .upsert({ user_id: superAdminId, role: "super_admin" }, { onConflict: "user_id" });
    console.log("Super admin global role ensured");

    // 3. Create School Admin
    const schoolAdminId = await getOrCreateUser(
      "admin@thptnguyen-trai.edu.vn",
      "SchoolAdmin123!",
      "Nguyễn Văn Admin",
      "nguyenadmin",
      "0912345678"
    );

    // Ensure school membership
    await supabase
      .from("school_memberships")
      .upsert({
        school_id: school.id,
        user_id: schoolAdminId,
        role: "admin",
        status: "active"
      }, { onConflict: "school_id,user_id" });
    console.log("School admin membership ensured");

    // 4. Create Teacher
    const teacherId = await getOrCreateUser(
      "teacher@thptnguyen-trai.edu.vn",
      "Teacher123!",
      "Trần Thị Giáo Viên",
      "trantgv",
      "0923456789"
    );

    // 5. Create Classes if not exist
    const { data: existingClasses } = await supabase
      .from("classes")
      .select()
      .eq("school_id", school.id);

    let classes = existingClasses || [];
    if (classes.length === 0) {
      const classesData = [
        { name: "10A1", grade: 10, school_year: "2024-2025" },
        { name: "10A2", grade: 10, school_year: "2024-2025" },
        { name: "11A1", grade: 11, school_year: "2024-2025" },
        { name: "11A2", grade: 11, school_year: "2024-2025" },
        { name: "12A1", grade: 12, school_year: "2024-2025" },
      ];

      const { data: newClasses, error: classesError } = await supabase
        .from("classes")
        .insert(classesData.map(c => ({ ...c, school_id: school.id })))
        .select();
      if (classesError) throw classesError;
      classes = newClasses;
      console.log("Created classes:", classes.length);
    } else {
      console.log("Classes already exist:", classes.length);
    }

    // Find class 10A1 for teacher assignment
    const class10A1 = classes.find(c => c.name === "10A1");
    if (class10A1) {
      await supabase
        .from("school_memberships")
        .upsert({
          school_id: school.id,
          user_id: teacherId,
          role: "class_teacher",
          class_id: class10A1.id,
          status: "active"
        }, { onConflict: "school_id,user_id" });
      console.log("Teacher membership ensured for class 10A1");
    }

    // 6. Create Students if not exist
    const { data: existingStudents } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", school.id)
      .limit(1);

    let studentsCount = 0;
    if (!existingStudents || existingStudents.length === 0) {
      const studentNames = [
        { full_name: "Nguyễn Văn An", gender: "male" },
        { full_name: "Trần Thị Bình", gender: "female" },
        { full_name: "Lê Văn Cường", gender: "male" },
        { full_name: "Phạm Thị Dung", gender: "female" },
        { full_name: "Hoàng Văn Em", gender: "male" },
        { full_name: "Ngô Thị Fương", gender: "female" },
        { full_name: "Đặng Văn Giang", gender: "male" },
        { full_name: "Vũ Thị Hoa", gender: "female" },
        { full_name: "Bùi Văn Inh", gender: "male" },
        { full_name: "Lý Thị Kim", gender: "female" },
      ];

      const studentsData = [];
      let studentIndex = 1;

      for (const cls of classes) {
        for (let i = 0; i < 10; i++) {
          const nameData = studentNames[i % studentNames.length];
          studentsData.push({
            school_id: school.id,
            class_id: cls.id,
            student_code: `HS${String(studentIndex).padStart(4, "0")}`,
            full_name: `${nameData.full_name} ${cls.name}`,
            gender: nameData.gender,
            date_of_birth: `200${Math.floor(Math.random() * 9)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`,
            is_boarding: Math.random() > 0.3,
            is_active: true,
            parent_phone: `09${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`
          });
          studentIndex++;
        }
      }

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .insert(studentsData)
        .select();
      if (studentsError) throw studentsError;
      studentsCount = students.length;
      console.log("Created students:", studentsCount);
    } else {
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("school_id", school.id);
      studentsCount = count || 0;
      console.log("Students already exist:", studentsCount);
    }

    // 7. Enable all features for the school
    const features = ["dashboard", "students", "evening_study", "boarding", "meals", "statistics", "duty_schedule", "user_management", "settings"];
    
    for (const code of features) {
      await supabase
        .from("school_features")
        .upsert({
          school_id: school.id,
          feature_code: code,
          is_enabled: true
        }, { onConflict: "school_id,feature_code" });
    }
    console.log("School features ensured");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Seed data created/verified successfully",
        data: {
          school: { id: school.id, name: school.name },
          superAdmin: { email: "superadmin@test.com", password: "SuperAdmin123!" },
          schoolAdmin: { email: "admin@thptnguyen-trai.edu.vn", password: "SchoolAdmin123!" },
          teacher: { email: "teacher@thptnguyen-trai.edu.vn", password: "Teacher123!" },
          classesCount: classes.length,
          studentsCount: studentsCount
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Seed error:", error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
