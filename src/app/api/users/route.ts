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

    // Check if user has permission (Admin or Manager)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!currentUser || (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Filter users based on role
    let whereClause: any = {
      status: 2, // Active users only
    };

    // Managers cannot see Admin users
    if (currentUser.role === 'MANAGER') {
      whereClause.role = {
        not: 'ADMINISTRATOR',
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        profile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (Admin or Manager)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!currentUser || (currentUser.role !== 'ADMINISTRATOR' && currentUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { username, email, password, role, firstName, lastName } = data;

    // Validate role assignment based on current user's role
    if (currentUser.role === 'MANAGER') {
      // Manager cannot create Admin users
      if (role === 'ADMINISTRATOR') {
        return NextResponse.json({ error: 'Managers cannot create Administrator accounts' }, { status: 403 });
      }
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: role || 'USER',
        status: 2, // Active
      },
      include: {
        profile: true,
      },
    });

    // Create profile if firstName or lastName provided
    if (firstName || lastName) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          firstName: firstName || null,
          lastName: lastName || null,
          locale: 'en-US',
        },
      });
    }

    return NextResponse.json({ user, success: true });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
