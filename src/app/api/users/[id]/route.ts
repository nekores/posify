import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!currentUser || (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!currentUser || (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { role, status, firstName, lastName, email } = data;

    // Get the user being updated
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Role assignment restrictions
    if (currentUser.role === 'MANAGER') {
      // Manager cannot change roles to Admin
      if (role === 'ADMINISTRATOR') {
        return NextResponse.json({ error: 'Managers cannot assign Administrator role' }, { status: 403 });
      }
      // Manager cannot change Admin users' roles
      if (targetUser.role === 'ADMINISTRATOR') {
        return NextResponse.json({ error: 'Managers cannot modify Administrator accounts' }, { status: 403 });
      }
    }

    // Update user
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (email !== undefined) updateData.email = email;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      include: {
        profile: true,
      },
    });

    // Update profile if provided
    if (firstName !== undefined || lastName !== undefined) {
      await prisma.userProfile.upsert({
        where: { userId: params.id },
        update: {
          firstName: firstName || null,
          lastName: lastName || null,
        },
        create: {
          userId: params.id,
          firstName: firstName || null,
          lastName: lastName || null,
          locale: 'en-US',
        },
      });
    }

    return NextResponse.json({ user, success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!currentUser || currentUser.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ error: 'Forbidden - Only Administrators can delete users' }, { status: 403 });
    }

    // Prevent deleting yourself
    if (params.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete by setting status to deleted
    await prisma.user.update({
      where: { id: params.id },
      data: { status: 3 }, // Deleted
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
