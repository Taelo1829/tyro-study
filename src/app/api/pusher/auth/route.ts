// app/api/pusher/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log(session);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { socket_id, channel_name } = body;

    // Validate channel name format
    if (!channel_name.match(/^(private-|presence-)/)) {
      return NextResponse.json(
        { error: "Invalid channel name. Channel must be private or presence." },
        { status: 400 }
      );
    }

    // For presence channels, provide user info
    if (channel_name.startsWith('presence-')) {
      const presenceData = {
        user_id: user.id,
        user_info: {
          name: user.name,
          email: user.email,
        },
      };
      
      const auth = pusherServer.authorizeChannel(socket_id, channel_name, presenceData);
      return NextResponse.json(auth);
    }

    // For private channels
    const auth = pusherServer.authorizeChannel(socket_id, channel_name);
    return NextResponse.json(auth);
    
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}