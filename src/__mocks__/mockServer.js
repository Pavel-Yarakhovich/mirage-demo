import { Server, Model, RestSerializer } from "miragejs";
import { faker } from "@faker-js/faker";

const HOST = process.env.REACT_APP_API_HOST;

export function startMockServer({ environment = "development" } = {}) {
  return new Server({
    environment,

    timing: 200, // global timing parameter
    urlPrefix: HOST,

    models: {
      teammate: Model,
    },

    serializers: {
      teammate: RestSerializer.extend({
        root: false,
        embed: true,
      }),
    },

    seeds(server) {
      // server.create("teammate", {
      //   name: faker.name.fullName(),
      //   occupation: faker.random.word(),
      //   avatar: faker.image.avatar(80, 80),
      // });
    },

    routes() {
      // Get teammates
      this.get(`/team`, (schema) => schema.teammates.all(), {
        timing: 400,
      }); // timing specific to this route

      // Create a teammate
      this.post(`/team`, (schema, req) => {
        const { name, occupation } = JSON.parse(req.requestBody);
        return schema.teammates.create({
          name,
          occupation,
          avatar: faker.image.avatar(80, 80),
        });
      });

      // Update a teammate
      this.put(`/team/:id`, (schema, req) => {
        const { id } = req.params;
        const { name, occupation } = JSON.parse(req.requestBody);
        const teammate = schema.teammates.findBy({ id });
        teammate.update({ name, occupation });
        return schema.teammates.findBy({ id });
      });

      // Delete a teammate
    },
  });
}
