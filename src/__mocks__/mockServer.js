import { Server } from "miragejs";
import { v4 } from "uuid";

const HOST = process.env.REACT_APP_API_HOST;
const AVATAR = process.env.REACT_APP_AVATAR;

let team = [
  {
    id: "1",
    name: "Mocked John",
    occupation: "Developer",
    avatar: AVATAR,
  },
];

export function startMockServer({ environment = "development" } = {}) {
  return new Server({
    environment,

    timing: 200, // global timing parameter
    urlPrefix: HOST,

    // routes() {
    //   // Get teammates
    //   this.get(`/team`, () => team, { timing: 400 }); // timing specific to this route

    //   // Create a teammate
    //   this.post(`/team`, (_, req) => {
    //     const { name, occupation } = JSON.parse(req.requestBody);
    //     const teammate = {
    //       id: v4(),
    //       name,
    //       occupation,
    //       avatar: AVATAR,
    //     };
    //     team.push(teammate);
    //     return teammate;
    //   });

    //   // Update a teammate
    //   this.put(`/team/:id`, (_, req) => {
    //     const { id } = req.params;
    //     const { name, occupation } = JSON.parse(req.requestBody);
    //     team = team.map((teammate) => {
    //       if (teammate.id === String(id)) {
    //         return {
    //           ...teammate,
    //           name,
    //           occupation,
    //         };
    //       } else {
    //         return teammate;
    //       }
    //     });
    //     const updatedTeammate = team.find((teammate) => teammate.id === id);
    //     return updatedTeammate;
    //   });

    //   // Delete a teammate
    //   this.delete(`/team/:id`, (_, req) => {
    //     const { id } = req.params;
    //     team = team.filter((teammate) => teammate.id !== String(id));
    //     return team;
    //   });
    // },
  });
}
