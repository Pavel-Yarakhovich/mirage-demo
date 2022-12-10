import { useState, useEffect } from "react";
import "./App.css";

import axios from "axios";

import { useSelector, useDispatch } from "react-redux";
import {
  increment,
  decrement,
  setByAmount,
} from "./features/team/teamSizeSlice";
import { sagaActions } from "./store/saga/sagaActions";

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
        type="text"
        value={localValues.name}
        onChange={({ target }) =>
          setLocalValues((prev) => ({ ...prev, name: target.value }))
        }
        className="form_input"
      />
      <input
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
        <button className="form_submit" type="submit">
          Confirm
        </button>
      </div>
    </form>
  );
}

function App() {
  const [isCreating, setIsCreating] = useState(false);
  const [edit, setEdit] = useState();

  const [team, setTeam] = useState();
  const [fetching, setFetching] = useState(false);

  const dispatch = useDispatch();
  const teamSize = useSelector((state) => state.teamSize.value);
  const randomData = useSelector((state) => state.randomData.dataPerTeammate);
  console.log("randomData ", randomData);
  useEffect(() => {
    if (team || fetching) return;
    setFetching(true);
    console.log("GET");
    axios
      .get(`${HOST}/team`)
      .then((response) => {
        setFetching(false);
        const team = response?.data ?? [];
        setTeam(team);
        dispatch(setByAmount(team.length));
      })
      .catch((error) => {
        setFetching(false);
        console.log("GET ERROR", error);
      });
  }, [dispatch, team, fetching]);

  const deleteTeammate = (id) => {
    axios
      .delete(`${HOST}/team/${id}`)
      .then((response) => {
        setTeam(response?.data ?? []);
        dispatch(decrement());
      })
      .catch((error) => console.log("DELETE ERROR", error));
  };

  const createTeammate = ({ name, occupation }) => {
    if (!name || !occupation) return;
    axios
      .post(`${HOST}/team`, { name, occupation, avatar: AVATAR })
      .then((response) => {
        setTeam((team) => [...team, response.data]);
        dispatch(increment());
        dispatch({
          type: sagaActions.FETCH_DATA_SAGA,
          payload: response.data.id,
        });
      })
      .catch((error) => console.log("POST ERROR", error));
    setIsCreating(false);
  };

  const updateTeammate = ({ id, name, occupation }) => {
    axios
      .put(`${HOST}/team/${id}`, { name, occupation })
      .then((response) => {
        setTeam((team) => {
          return team.map((mate) => {
            if (mate.id === response.data.id) {
              return response.data;
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
      <header className="App-header">
        Team {"[ "}
        {teamSize}
        {" ]"}
      </header>
      <main className="App-content ">
        <video
          style={{ position: "fixed" }}
          tabindex="-1"
          disableremoteplayback=""
          webkit-playsinline=""
          playsinline=""
          src="https://aesport.tv/f7c21009-c8e0-48b9-b4fa-ee8453da6b2e"
        ></video>
        {/* <section className="App-content-list">
          {team?.map((teammate) => (
            <div className="teammate" key={teammate.id}>
              <img
                src={teammate.avatar}
                alt="name"
                className="teammate_image"
              />
              <div className="teammate_name">{teammate.name}</div>
              <div className="teammmate_occupation">{teammate.occupation}</div>

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

              {!!randomData?.[teammate.id] && (
                <div>
                  {randomData[teammate.id]?.loading ? (
                    <div>Loading...</div>
                  ) : (
                    <div>Got random data</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="action_column">
          {isCreating ? (
            <section className="App-content-create">
              <h3>Add teammate</h3>
              <Form
                key="create"
                values={{ name: "", occupation: "" }}
                onSubmit={createTeammate}
                onCancel={() => setIsCreating(false)}
              />
            </section>
          ) : (
            <button
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
                key="edit"
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
        </div> */}
      </main>
    </div>
  );
}

export default App;
