#!/usr/bin/env node
/**
 * Seed the first admin.
 *
 * A CLI rather than a UI: the old flow used supabase.auth.signUp(), which was a
 * PUBLIC endpoint -- anyone with the anon key could create an account. The
 * replacement (POST /api/auth/users) requires an existing ADMIN session, so the
 * first one has to be created out-of-band. That is the point, not an oversight.
 *
 *   node scripts/create-admin.js +6281234567890
 *
 * Prompts for the password rather than taking it as an argument: argv lands in
 * shell history and in the process list, where any other user on the box can
 * read it.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcrypt';
import { prisma } from '../src/prisma.js';
import { tryNormalizePhone } from '../src/lib/phone.js';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD = 10;

async function promptHidden(rl, question) {
  // Suppress echo so the password is not left on screen or in a screenshot.
  const onData = (char) => {
    if (['\n', '\r', ''].includes(char.toString())) return;
    stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length));
  };
  stdin.on('data', onData);
  try {
    return await rl.question(question);
  } finally {
    stdin.off('data', onData);
    stdout.write('\n');
  }
}

async function main() {
  const [rawPhone, rawCountry = 'ID'] = process.argv.slice(2);

  if (!rawPhone) {
    console.error('Usage: node scripts/create-admin.js <phone> [countryCode]');
    console.error('   e.g. node scripts/create-admin.js 081234567890 ID');
    process.exit(1);
  }

  const phone = tryNormalizePhone(rawPhone, rawCountry.toUpperCase());
  if (!phone.ok) {
    console.error(`Invalid phone (${phone.reason}): ${rawPhone}`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { phoneE164: phone.value } });
  if (existing) {
    console.error(`A user already exists for ${phone.value} (role: ${existing.role}).`);
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    const password = await promptHidden(rl, `Password for ${phone.value}: `);
    const confirm = await promptHidden(rl, 'Confirm password: ');

    if (password !== confirm) {
      console.error('Passwords do not match.');
      process.exit(1);
    }
    if (password.length < MIN_PASSWORD) {
      console.error(`Password must be at least ${MIN_PASSWORD} characters.`);
      process.exit(1);
    }

    const user = await prisma.user.create({
      data: {
        phoneE164: phone.value,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: 'ADMIN',
      },
      select: { id: true, phoneE164: true, role: true },
    });

    console.log(`Created ${user.role} ${user.phoneE164} (${user.id})`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err.message ?? err);
  await prisma.$disconnect();
  process.exit(1);
});
