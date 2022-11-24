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
  const { name, occupation } = req?.body;
  if (!name || !occupation) {
    return res.json({ error: "Wrong data" });
  }

  const teammate = await prisma.team.create({
    data: {
      name,
      occupation,
      avatar:
        "https://img.freepik.com/free-vector/cute-girl-gaming-holding-joystick-cartoon-icon-illustration-people-technology-icon-concept-isolated-flat-cartoon-style_138676-2169.jpg?w=826&t=st=1669140681~exp=1669141281~hmac=87c1049d81317ac3cb9db425c21eb9c5c80b1eacfd1b13c715c91aaa4e2abdbc",
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
