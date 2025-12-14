import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // wipe in correct order (safe for re-seeding during dev)
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.spectacleOrder.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.userStore.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { name: "Aksha Demo Chain" },
  });

  const jubilee = await prisma.store.create({
    data: { tenantId: tenant.id, name: "Jubilee Hills", city: "Hyderabad" },
  });

  const kukatpally = await prisma.store.create({
    data: { tenantId: tenant.id, name: "Kukatpally", city: "Hyderabad" },
  });

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@aksha.demo",
      name: "Chain Owner Admin",
      role: Role.ADMIN,
    },
  });

  const doctor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "doctor@aksha.demo",
      name: "Dr. Rao",
      role: Role.DOCTOR,
    },
  });

  const billing = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "billing@aksha.demo",
      name: "Billing Staff",
      role: Role.BILLING,
    },
  });

  await prisma.userStore.createMany({
    data: [
      { userId: admin.id, storeId: jubilee.id },
      { userId: admin.id, storeId: kukatpally.id },
      { userId: doctor.id, storeId: jubilee.id },
      { userId: billing.id, storeId: jubilee.id },
    ],
  });

  console.log("✅ Seed complete");
  console.table({
    tenantId: tenant.id,
    jubileeStoreId: jubilee.id,
    kukatpallyStoreId: kukatpally.id,
    adminUserId: admin.id,
    doctorUserId: doctor.id,
    billingUserId: billing.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
