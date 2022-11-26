const { Prisma, PrismaClient } = require("@prisma/client");
const express = require("express");
const cors = require("cors");

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());

app.get("/team", async (req, res) => {
  const team = await prisma.team.findMany();
  res.json(team);
});

app.put("/team/:id", async (req, res) => {
  const { id } = req.params;
  const { name, occupation } = req?.body;
  if (!id) {
    return res.json({ error: "Wrong data" });
  }
  const teammate = await prisma.team.update({
    where: {
      id: Number(id),
    },
    data: {
      name,
      occupation,
    },
  });
  res.json(teammate);
});

app.post("/team", async (req, res) => {
  const { name, occupation, avatar } = req?.body;
  if (!name || !occupation) {
    return res.json({ error: "Wrong data" });
  }

  const teammate = await prisma.team.create({
    data: {
      name,
      occupation,
      avatar,
    },
  });
  return res.json(teammate);
});

app.delete("/team/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.team.delete({
    where: {
      id: Number(id),
    },
  });
  const team = await prisma.team.findMany();
  res.json(team);
});

const server = app.listen(3002, () =>
  console.log(`
🚀 Server ready at: http://localhost:3002`)
);
