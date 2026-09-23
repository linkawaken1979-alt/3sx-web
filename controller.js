(() => {
  "use strict";

  const canvas = document.getElementById("canvas");

  /*
   * PLAYER 1
   * Your existing working controls.
   */
  const PLAYER1_BUTTON_KEYS = {
    0: "u",
    1: "i",
    2: "j",
    3: "k",
    4: "o",
    5: "p",
    6: "l",
    7: ";",
    9: "Enter"
  };

  /*
   * PLAYER 2
   *
   * These are deliberately different from Player 1 so both
   * controllers can send input at the same time.
   *
   * If your 3SX config uses different P2 keyboard bindings,
   * change ONLY these values.
   */
  const PLAYER2_BUTTON_KEYS = {
    0: "1",
    1: "2",
    2: "3",
    3: "4",
    4: "5",
    5: "6",
    6: "7",
    7: "8",
    9: "NumpadEnter"
  };

  /*
   * Player 1 movement.
   */
  const PLAYER1_MOVEMENT_KEYS = {
    up: "w",
    down: "s",
    left: "a",
    right: "d"
  };

  /*
   * Player 2 movement.
   *
   * Uses arrow keys.
   */
  const PLAYER2_MOVEMENT_KEYS = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight"
  };

  const AXIS_DEADZONE = 0.28;

  /*
   * Controller state is kept separately.
   */
  const controllers = new Map();

  /*
   * Keys currently held by each controller.
   *
   * controllerKeys.get(index) -> Set of keys.
   */
  const controllerKeys = new Map();

  let animationFrame = null;

  /*
   * ---------------------------------------------------------
   * DEVICE DISPLAY
   * ---------------------------------------------------------
   */

  function controllerName(gamepad) {
    const id = (gamepad.id || "").toLowerCase();

    if (
      id.includes("xbox") ||
      id.includes("xinput") ||
      id.includes("microsoft")
    ) {
      return "Xbox controller";
    }

    if (
      id.includes("playstation") ||
      id.includes("dualshock") ||
      id.includes("dualsense") ||
      id.includes("054c")
    ) {
      return "PlayStation controller";
    }

    if (
      id.includes("nintendo") ||
      id.includes("switch") ||
      id.includes("joy-con") ||
      id.includes("joycon") ||
      id.includes("pro controller")
    ) {
      return "Nintendo Switch controller";
    }

    return "Gamepad";
  }

  function createSecondDeviceDisplay() {
    const first = document.getElementById("device-status");

    if (!first) {
      return null;
    }

    let second = document.getElementById("device-status-2");

    if (second) {
      return second;
    }

    second = document.createElement("div");

    second.id = "device-status-2";
    second.className = "device-status";

    second.innerHTML = `
      <span class="device-dot"></span>
      <div>
        <strong>Connected Device 2</strong>
        <span id="device-name-2">No controller connected</span>
      </div>
    `;

    /*
     * Put Controller 2 directly underneath Controller 1.
     */
    first.parentNode.insertBefore(
      second,
      first.nextSibling
    );

    return second;
  }

  function updateDeviceStatus(player, gamepad) {
    let status;
    let name;

    if (player === 1) {
      status = document.getElementById("device-status");
      name = document.getElementById("device-name");
    } else {
      const second = createSecondDeviceDisplay();

      status = second;
      name = document.getElementById("device-name-2");
    }

    if (!status || !name) {
      return;
    }

    status.classList.add("connected");

    const type = controllerName(gamepad);
    const id = gamepad.id || "Unknown controller";

    name.textContent = `${type} — ${id}`;

    console.log(
      `[3SX Controller] Player ${player} device:`,
      type,
      id
    );
  }

  function clearDeviceStatus(player) {
    let status;
    let name;

    if (player === 1) {
      status = document.getElementById("device-status");
      name = document.getElementById("device-name");
    } else {
      status = document.getElementById("device-status-2");
      name = document.getElementById("device-name-2");
    }

    if (!status || !name) {
      return;
    }

    status.classList.remove("connected");

    name.textContent =
      "No controller connected";
  }

  /*
   * ---------------------------------------------------------
   * KEYBOARD EMULATION
   * ---------------------------------------------------------
   */

  function keyToCode(key) {
    switch (key) {
      case "w":
        return "KeyW";

      case "a":
        return "KeyA";

      case "s":
        return "KeyS";

      case "d":
        return "KeyD";

      case "u":
        return "KeyU";

      case "i":
        return "KeyI";

      case "j":
        return "KeyJ";

      case "k":
        return "KeyK";

      case "o":
        return "KeyO";

      case "p":
        return "KeyP";

      case "l":
        return "KeyL";

      case ";":
        return "Semicolon";

      case "ArrowUp":
        return "ArrowUp";

      case "ArrowDown":
        return "ArrowDown";

      case "ArrowLeft":
        return "ArrowLeft";

      case "ArrowRight":
        return "ArrowRight";

      case "1":
        return "Digit1";

      case "2":
        return "Digit2";

      case "3":
        return "Digit3";

      case "4":
        return "Digit4";

      case "5":
        return "Digit5";

      case "6":
        return "Digit6";

      case "7":
        return "Digit7";

      case "8":
        return "Digit8";

      case "Enter":
        return "Enter";

      case "NumpadEnter":
        return "NumpadEnter";

      default:
        return "";
    }
  }

  function emitControllerKey(controllerIndex, key, down) {
    if (!controllerKeys.has(controllerIndex)) {
      controllerKeys.set(
        controllerIndex,
        new Set()
      );
    }

    const keys =
      controllerKeys.get(controllerIndex);

    const alreadyDown =
      keys.has(key);

    if (down === alreadyDown) {
      return;
    }

    if (down) {
      keys.add(key);
    } else {
      keys.delete(key);
    }

    const event = new KeyboardEvent(
      down ? "keydown" : "keyup",
      {
        key,
        code: keyToCode(key),
        bubbles: true,
        cancelable: true,
        composed: true,
        repeat: false
      }
    );

    document.dispatchEvent(event);
  }

  /*
   * ---------------------------------------------------------
   * GAMEPAD HELPERS
   * ---------------------------------------------------------
   */

  function buttonDown(gamepad, index) {
    const button =
      gamepad.buttons[index];

    if (!button) {
      return false;
    }

    return (
      button.pressed ||
      button.value > 0.5
    );
  }

  function axisValue(gamepad, index) {
    const value =
      gamepad.axes[index];

    if (typeof value !== "number") {
      return 0;
    }

    return Math.abs(value) >= AXIS_DEADZONE
      ? value
      : 0;
  }

  /*
   * ---------------------------------------------------------
   * MOVEMENT
   * ---------------------------------------------------------
   */

  function updateMovement(
    gamepad,
    player
  ) {
    const x =
      axisValue(gamepad, 0);

    const y =
      axisValue(gamepad, 1);

    let left =
      x < -AXIS_DEADZONE;

    let right =
      x > AXIS_DEADZONE;

    let up =
      y < -AXIS_DEADZONE;

    let down =
      y > AXIS_DEADZONE;

    /*
     * D-pad.
     */
    up =
      up ||
      buttonDown(gamepad, 12);

    down =
      down ||
      buttonDown(gamepad, 13);

    left =
      left ||
      buttonDown(gamepad, 14);

    right =
      right ||
      buttonDown(gamepad, 15);

    const keys =
      player === 1
        ? PLAYER1_MOVEMENT_KEYS
        : PLAYER2_MOVEMENT_KEYS;

    const index =
      gamepad.index;

    emitControllerKey(
      index,
      keys.up,
      up
    );

    emitControllerKey(
      index,
      keys.down,
      down
    );

    emitControllerKey(
      index,
      keys.left,
      left
    );

    emitControllerKey(
      index,
      keys.right,
      right
    );
  }

  /*
   * ---------------------------------------------------------
   * BUTTONS
   * ---------------------------------------------------------
   */

  function updateButtons(
    gamepad,
    player
  ) {
    const mapping =
      player === 1
        ? PLAYER1_BUTTON_KEYS
        : PLAYER2_BUTTON_KEYS;

    for (
      const [index, key]
      of Object.entries(mapping)
    ) {
      emitControllerKey(
        gamepad.index,
        key,
        buttonDown(
          gamepad,
          Number(index)
        )
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * RELEASE ONE CONTROLLER
   * ---------------------------------------------------------
   */

  function releaseController(
    gamepadIndex
  ) {
    const keys =
      controllerKeys.get(
        gamepadIndex
      );

    if (!keys) {
      return;
    }

    for (
      const key of [...keys]
    ) {
      const event =
        new KeyboardEvent(
          "keyup",
          {
            key,
            code: keyToCode(key),
            bubbles: true,
            cancelable: true,
            composed: true,
            repeat: false
          }
        );

      document.dispatchEvent(event);
    }

    keys.clear();

    controllerKeys.delete(
      gamepadIndex
    );
  }

  /*
   * ---------------------------------------------------------
   * PLAYER ASSIGNMENT
   * ---------------------------------------------------------
   *
   * The first connected controller becomes
   * Player 1.
   *
   * The second connected controller becomes
   * Player 2.
   *
   * Gamepad.index is used to distinguish devices.
   */

  function getPlayerForController(
    gamepadIndex
  ) {
    const entries =
      [...controllers.entries()]
        .sort(
          (a, b) =>
            a[1].connected === b[1].connected
              ? a[0] - b[0]
              : a[1].connected
                ? -1
                : 1
        );

    const active =
      entries
        .filter(
          ([, gamepad]) =>
            gamepad &&
            gamepad.connected !== false
        )
        .slice(0, 2);

    for (
      let i = 0;
      i < active.length;
      i++
    ) {
      if (
        active[i][0] ===
        gamepadIndex
      ) {
        return i + 1;
      }
    }

    return 0;
  }

  /*
   * ---------------------------------------------------------
   * POLLING
   * ---------------------------------------------------------
   */

  function pollControllers() {
    const gamepads =
      navigator.getGamepads
        ? navigator.getGamepads()
        : [];

    const visible =
      new Map();

    for (
      const gamepad
      of gamepads
    ) {
      if (!gamepad) {
        continue;
      }

      visible.set(
        gamepad.index,
        gamepad
      );
    }

    /*
     * Remove controllers that disappeared.
     */
    for (
      const index
      of controllers.keys()
    ) {
      if (
        !visible.has(index)
      ) {
        releaseController(index);
        controllers.delete(index);
      }
    }

    /*
     * Add/update controllers.
     */
    for (
      const [index, gamepad]
      of visible
    ) {
      controllers.set(
        index,
        gamepad
      );
    }

    /*
     * Assign the first two controllers
     * to Player 1 and Player 2.
     */
    const active =
      [...controllers.entries()]
        .sort(
          (a, b) =>
            a[0] - b[0]
        )
        .slice(0, 2);

    for (
      let i = 0;
      i < active.length;
      i++
    ) {
      const [
        index,
        gamepad
      ] = active[i];

      const player =
        i + 1;

      updateDeviceStatus(
        player,
        gamepad
      );

      updateMovement(
        gamepad,
        player
      );

      updateButtons(
        gamepad,
        player
      );
    }

    /*
     * Clear unused device displays.
     */
    if (active.length < 1) {
      clearDeviceStatus(1);
    }

    if (active.length < 2) {
      clearDeviceStatus(2);
    }

    animationFrame =
      requestAnimationFrame(
        pollControllers
      );
  }

  /*
   * ---------------------------------------------------------
   * CONNECT
   * ---------------------------------------------------------
   */

  function controllerConnected(event) {
    const gamepad =
      event.gamepad;

    if (!gamepad) {
      return;
    }

    /*
     * Only support two controllers.
     */
    if (
      controllers.size >= 2 &&
      !controllers.has(
        gamepad.index
      )
    ) {
      console.warn(
        "[3SX Controller] Two controllers are already connected. Ignoring:",
        gamepad.id
      );

      return;
    }

    controllers.set(
      gamepad.index,
      gamepad
    );

    const player =
      getPlayerForController(
        gamepad.index
      );

    console.log(
      `[3SX Controller] Player ${player} connected:`,
      controllerName(gamepad),
      gamepad.id,
      `index=${gamepad.index}`
    );

    if (player === 1) {
      updateDeviceStatus(
        1,
        gamepad
      );
    }

    if (player === 2) {
      updateDeviceStatus(
        2,
        gamepad
      );
    }

    if (canvas) {
      canvas.focus();
    }
  }

  /*
   * ---------------------------------------------------------
   * DISCONNECT
   * ---------------------------------------------------------
   */

  function controllerDisconnected(
    event
  ) {
    const gamepad =
      event.gamepad;

    if (!gamepad) {
      return;
    }

    const player =
      getPlayerForController(
        gamepad.index
      );

    releaseController(
      gamepad.index
    );

    controllers.delete(
      gamepad.index
    );

    console.log(
      `[3SX Controller] Player ${player} disconnected:`,
      controllerName(gamepad)
    );

    /*
     * Reassign remaining controllers
     * so the connected device list stays
     * in Player 1 / Player 2 order.
     */
    const remaining =
      [...controllers.values()]
        .sort(
          (a, b) =>
            a.index - b.index
        )
        .slice(0, 2);

    clearDeviceStatus(1);
    clearDeviceStatus(2);

    if (remaining[0]) {
      updateDeviceStatus(
        1,
        remaining[0]
      );
    }

    if (remaining[1]) {
      updateDeviceStatus(
        2,
        remaining[1]
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * EVENTS
   * ---------------------------------------------------------
   */

  window.addEventListener(
    "gamepadconnected",
    controllerConnected
  );

  window.addEventListener(
    "gamepaddisconnected",
    controllerDisconnected
  );

  /*
   * ---------------------------------------------------------
   * INITIALIZATION
   * ---------------------------------------------------------
   */

  window.addEventListener(
    "load",
    () => {
      if (canvas) {
        canvas.addEventListener(
          "click",
          () => {
            canvas.focus();
          }
        );
      }

      console.log(
        "[3SX Controller] Two-controller support enabled."
      );

      const gamepads =
        navigator.getGamepads
          ? navigator.getGamepads()
          : [];

      /*
       * Detect controllers that were already
       * connected before the page loaded.
       */
      for (
        const gamepad
        of gamepads
      ) {
        if (!gamepad) {
          continue;
        }

        if (
          controllers.size >= 2
        ) {
          break;
        }

        controllers.set(
          gamepad.index,
          gamepad
        );

        console.log(
          "[3SX Controller] Existing controller:",
          gamepad.index,
          controllerName(gamepad),
          gamepad.id
        );
      }

      /*
       * Create the second display immediately
       * if the first device display exists.
       */
      createSecondDeviceDisplay();

      animationFrame =
        requestAnimationFrame(
          pollControllers
        );
    }
  );

  /*
   * ---------------------------------------------------------
   * CLEANUP
   * ---------------------------------------------------------
   */

  window.addEventListener(
    "beforeunload",
    () => {
      if (
        animationFrame !== null
      ) {
        cancelAnimationFrame(
          animationFrame
        );
      }

      for (
        const index
        of controllers.keys()
      ) {
        releaseController(
          index
        );
      }

      controllers.clear();
    }
  );
})();