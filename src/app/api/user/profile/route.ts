import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      profile: user.profile ? {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        email: user.email,
        phone: user.profile.phone,
        avatar: user.profile.avatar,
        locale: user.profile.locale,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } : {
        firstName: null,
        lastName: null,
        email: user.email,
        phone: null,
        avatar: null,
        locale: 'en-US',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { firstName, lastName, phone } = data;

    // Check if profile exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Upsert profile
    const profile = await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: {
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
      },
      create: {
        userId: session.user.id,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        locale: 'en-US',
      },
    });

    return NextResponse.json({ profile, success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
