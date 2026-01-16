import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function resetPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    // Get username
    const username = process.argv[2] || (await question('Enter username to reset password: '));
    
    if (!username) {
      console.error('Username is required');
      process.exit(1);
    }

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { email: { equals: username, mode: 'insensitive' } },
        ],
      },
    });

    if (!user) {
      console.error(`User "${username}" not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.username} (${user.email})`);

    // Get new password
    const newPassword = process.argv[3] || (await question('Enter new password: '));
    
    if (!newPassword) {
      console.error('Password is required');
      process.exit(1);
    }

    // Confirm password
    if (!process.argv[3]) {
      const confirmPassword = await question('Confirm new password: ');
      if (newPassword !== confirmPassword) {
        console.error('Passwords do not match');
        process.exit(1);
      }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`✅ Password reset successfully for user "${user.username}"`);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

resetPassword();
