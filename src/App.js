import { useState, useEffect } from "react";
import "./App.css";

import axios from "axios";

const HOST = process.env.REACT_APP_API_HOST;
const AVATAR = process.env.REACT_APP_AVATAR;

function Form({ onSubmit, values, onCancel }) {
  const [localValues, setLocalValues] = useState(values);

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(localValues);
        setLocalValues({});
      }}
    >
      <input
        data-testid="name"
        type="text"
        value={localValues.name}
        onChange={({ target }) =>
          setLocalValues((prev) => ({ ...prev, name: target.value }))
        }
        className="form_input"
      />
      <input
        data-testid="occupation"
        type="text"
        value={localValues.occupation}
        onChange={({ target }) =>
          setLocalValues((prev) => ({ ...prev, occupation: target.value }))
        }
        className="form_input"
      />
      <div className="form_buttons">
        <button className="form_cancel" onClick={onCancel}>
          Cancel
        </button>
        <button className="form_submit" type="submit" data-testid="submit">
          Confirm
        </button>
      </div>
    </form>
  );
}

function App() {
  const [isCreating, setIsCreating] = useState(false);
  const [edit, setEdit] = useState();

  const [team, setTeam] = useState([]);

  useEffect(() => {
    axios
      .get(`${HOST}/team`)
      .then((response) => {
        setTeam(response?.data?.teammates ?? []);
      })
      .catch((error) => console.log("GET ERROR", error));
  }, []);

  const deleteTeammate = (id) => {
    axios
      .delete(`${HOST}/team/${id}`)
      .then((response) => setTeam(response?.data?.teammates ?? []))
      .catch((error) => console.log("DELETE ERROR", error));
  };

  const createTeammate = ({ name, occupation }) => {
    if (!name || !occupation) return;
    axios
      .post(`${HOST}/team`, { name, occupation, avatar: AVATAR })
      .then((response) => setTeam((team) => [...team, response.data.teammate]))
      .catch((error) => console.log("POST ERROR", error));
    setIsCreating(false);
  };

  const updateTeammate = ({ id, name, occupation }) => {
    axios
      .put(`${HOST}/team/${id}`, { name, occupation })
      .then((response) => {
        setTeam((team) => {
          return team.map((mate) => {
            if (mate.id === response.data.teammate.id) {
              return response.data.teammate;
            } else {
              return mate;
            }
          });
        });
        setEdit(null);
      })
      .catch((error) => console.log("PUT ERROR", error));
  };

  return (
    <div className="App">
      <header className="App-header">Team</header>
      <main className="App-content ">
        <section className="App-content-list">
          {team?.length ? (
            team.map((teammate) => (
              <div
                className="teammate"
                key={teammate.id}
                data-testid="teammate-card"
              >
                <img
                  src={teammate.avatar}
                  alt="name"
                  className="teammate_image"
                />
                <div className="teammate_name">{teammate.name}</div>
                <div className="teammmate_occupation">
                  {teammate.occupation}
                </div>

                <button
                  className="teammate_edit"
                  onClick={() => {
                    setIsCreating(false);
                    setEdit(teammate);
                  }}
                >
                  Edit
                </button>
                <button
                  className="teammate_delete"
                  onClick={() => deleteTeammate(teammate.id)}
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <div className="no_teammates">No teammates</div>
          )}
        </section>

        <div className="action_column">
          {isCreating ? (
            <section
              className="App-content-create"
              data-testid="create_section"
            >
              <h3>Add teammate</h3>
              <Form
                values={{}}
                onSubmit={createTeammate}
                onCancel={() => setIsCreating(false)}
              />
            </section>
          ) : (
            <button
              data-testid="create_teammate"
              className="create_teammate"
              onClick={() => setIsCreating(true)}
            >
              Add teammate
            </button>
          )}

          {edit && (
            <section className="App-content-edit">
              <h3>Edit teammate</h3>
              <Form
                values={edit}
                onSubmit={(teammate) => {
                  updateTeammate(teammate);
                }}
                onCancel={() => {
                  setEdit(null);
                }}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
