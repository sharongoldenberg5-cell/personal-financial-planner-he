import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { PrismaClient } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const userId = user.id;
    const body = await request.json();
    const prisma = new PrismaClient();

    // Save profile
    if (body.profile) {
      const { createdAt, updatedAt, id, ...profileData } = body.profile;
      await prisma.profile.upsert({
        where: { userId },
        update: { ...profileData, userId },
        create: { ...profileData, userId },
      });
    }

    // Save assets
    if (body.assets?.length) {
      for (const asset of body.assets) {
        const { createdAt, updatedAt, ...data } = asset;
        await prisma.asset.upsert({
          where: { id: asset.id },
          update: { ...data, userId },
          create: { ...data, userId },
        });
      }
    }

    // Save liabilities
    if (body.liabilities?.length) {
      for (const l of body.liabilities) {
        const { createdAt, updatedAt, ...data } = l;
        await prisma.liability.upsert({
          where: { id: l.id },
          update: { ...data, userId },
          create: { ...data, userId },
        });
      }
    }

    // Save goals
    if (body.goals?.length) {
      for (const g of body.goals) {
        const { createdAt, updatedAt, ...data } = g;
        await prisma.goal.upsert({
          where: { id: g.id },
          update: { ...data, userId },
          create: { ...data, userId },
        });
      }
    }

    // Save recommendations
    if (body.recommendations?.length) {
      await prisma.recommendation.deleteMany({ where: { userId } });
      await prisma.recommendation.createMany({
        data: body.recommendations.map((r: any) => {
          const { createdAt, ...data } = r;
          return { ...data, userId };
        }),
      });
    }

    // Save retirement goals
    if (body.retirementGoals) {
      await prisma.retirementGoals.upsert({
        where: { userId },
        update: body.retirementGoals,
        create: { ...body.retirementGoals, userId },
      });
    }

    await prisma.$disconnect();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
