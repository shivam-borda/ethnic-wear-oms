import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify current user is admin
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (currentProfile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admin users can create new user accounts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, password, fullName, role } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and Password are required." },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const internalEmail = `${cleanUsername}@aahman.local`;

    // Sign up user via Supabase Auth
    const { data: newUser, error: signUpError } = await supabase.auth.signUp({
      email: internalEmail,
      password: password,
      options: {
        data: {
          full_name: fullName || cleanUsername,
          username: cleanUsername,
          role: role || "staff",
        },
      },
    });

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    if (newUser.user) {
      // Update profile in database
      await supabase
        .from("profiles")
        .update({
          username: cleanUsername,
          full_name: fullName || cleanUsername,
          role: role || "staff",
        })
        .eq("id", newUser.user.id);
    }

    return NextResponse.json({
      success: true,
      user: {
        username: cleanUsername,
        fullName,
        role: role || "staff",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
