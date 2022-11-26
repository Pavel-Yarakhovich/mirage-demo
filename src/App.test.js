import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

import { startMockServer } from "./mockServer";

const AVATAR = process.env.REACT_APP_AVATAR;

describe("<App />", () => {
  let server;
  beforeEach(() => {
    server = startMockServer({ environment: "test" });
  });

  afterEach(() => {
    server.shutdown();
  });

  test("renders No teammates if the list is empty", () => {
    render(<App />);
    const noTeammates = screen.getByText(/No teammates/i);
    expect(noTeammates).toBeInTheDocument();
  });

  test("properly renders teammates", async () => {
    const NUMBER_OF_TEAMATES = 7;
    [...Array(NUMBER_OF_TEAMATES)].forEach(() =>
      server.create("teammate", {
        name: "Test Name",
        occupation: "Test Occupation",
        avatar: AVATAR,
      })
    );

    render(<App />);
    await waitForElementToBeRemoved(() => screen.queryByText(/No teammates/i));

    const teammateCards = screen.getAllByTestId("teammate-card");
    expect(teammateCards.length).toBe(NUMBER_OF_TEAMATES);
  });

  test("can add a teammate to the list", async () => {
    render(<App />);
    const noTeammates = screen.getByText(/No teammates/i);
    expect(noTeammates).toBeInTheDocument();

    userEvent.click(screen.getByTestId("create_teammate"));
    await userEvent.type(screen.getByTestId("name"), "Test Name");
    await userEvent.type(screen.getByTestId("occupation"), "Test Occupation");
    userEvent.click(screen.getByTestId("submit"));

    await waitForElementToBeRemoved(() => screen.queryByText(/No teammates/i));

    const teammateCards = screen.getAllByTestId("teammate-card");
    expect(teammateCards.length).toBe(1);
  });
});
