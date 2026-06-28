(function(){
  "use strict";

  // ===========================================================
  // Cipher Toolkit — Solver (rosebud.js)
  //
  // Full solver versions of the rail fence and transposition widgets,
  // for teacher use. Not linked from the student-facing page.
  // ===========================================================

  // ===================== THEME TOGGLE =====================
  const themeSwitch = document.getElementById("themeSwitch");

  function setTheme(theme){
    if(theme === "amber"){
      document.documentElement.setAttribute("data-theme", "amber");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("cipherToolkitTheme", theme);
    themeSwitch.setAttribute("aria-pressed", theme === "amber" ? "true" : "false");
  }

  themeSwitch.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "amber" ? "amber" : "green";
    setTheme(current === "amber" ? "green" : "amber");
  });

  setTheme(document.documentElement.getAttribute("data-theme") === "amber" ? "amber" : "green");

  // ===================== TRANSPOSITION SOLVER =====================
  // Free-form input: paste any ciphertext, adjust columns, read off rows.
  const transInput = document.getElementById("transCipherInput");
  const rowsValueEl = document.getElementById("rowsValue");
  let cols = 5;

  function renderTransGrid(){
    const text = transInput.value.replace(/\s+/g, "").toUpperCase();
    const grid = document.getElementById("transGrid");
    grid.innerHTML = "";

    if(!text){
      grid.style.gridTemplateColumns = "";
      return;
    }

    const numRows = Math.ceil(text.length / cols);
    grid.style.gridTemplateColumns = "repeat(" + cols + ", 1.6rem)";

    for(let r = 0; r < numRows; r++){
      for(let c = 0; c < cols; c++){
        const idx = r * cols + c;
        const cell = document.createElement("div");
        cell.className = "trans-cell";
        cell.textContent = idx < text.length ? text[idx] : "";
        grid.appendChild(cell);
      }
    }
  }

  transInput.addEventListener("input", renderTransGrid);

  document.getElementById("rowsUp").addEventListener("click", () => {
    cols = Math.min(20, cols + 1);
    rowsValueEl.textContent = cols;
    renderTransGrid();
  });
  document.getElementById("rowsDown").addEventListener("click", () => {
    cols = Math.max(2, cols - 1);
    rowsValueEl.textContent = cols;
    renderTransGrid();
  });

  renderTransGrid();

  // ===================== RAIL FENCE SOLVER =====================
  // Decrypt direction: paste ciphertext, try rail counts, read off the result.
  const railInput = document.getElementById("railCipherInput");
  const railsValueEl = document.getElementById("railsValue");
  let railCount = 3;

  function railIndexPattern(length, rails){
    if(rails === 1) return new Array(length).fill(0);
    const cycle = 2 * (rails - 1);
    const pattern = [];
    for(let i = 0; i < length; i++){
      const pos = i % cycle;
      pattern.push(pos < rails ? pos : cycle - pos);
    }
    return pattern;
  }

  function decodeRailFence(ciphertext, rails){
    const railOf = railIndexPattern(ciphertext.length, rails);
    const grid = new Array(ciphertext.length).fill(null);
    let nextChar = 0;
    for(let r = 0; r < rails; r++){
      for(let c = 0; c < ciphertext.length; c++){
        if(railOf[c] === r){
          grid[c] = ciphertext[nextChar];
          nextChar++;
        }
      }
    }
    return { railOf, grid, plaintext: grid.join("") };
  }

  function renderRailFence(){
    const raw = railInput.value.replace(/\s+/g, "").toUpperCase();
    const gridEl = document.getElementById("railGrid");
    const readout = document.getElementById("railReadout");
    gridEl.innerHTML = "";

    if(!raw){
      readout.textContent = "\u2014";
      gridEl.style.gridTemplateColumns = "";
      return;
    }

    const { railOf, grid, plaintext } = decodeRailFence(raw, railCount);
    const length = raw.length;

    gridEl.style.gridTemplateColumns = "repeat(" + length + ", 1.6rem)";
    gridEl.style.gridTemplateRows = "repeat(" + railCount + ", auto)";

    for(let r = 0; r < railCount; r++){
      for(let c = 0; c < length; c++){
        const cell = document.createElement("div");
        if(railOf[c] === r){
          cell.className = "rail-cell filled";
          cell.textContent = grid[c];
        } else {
          cell.className = "rail-cell empty";
          cell.textContent = "\u00B7";
        }
        gridEl.appendChild(cell);
      }
    }

    readout.textContent = plaintext;
  }

  railInput.addEventListener("input", renderRailFence);

  document.getElementById("railsUp").addEventListener("click", () => {
    railCount = Math.min(8, railCount + 1);
    railsValueEl.textContent = railCount;
    renderRailFence();
  });
  document.getElementById("railsDown").addEventListener("click", () => {
    railCount = Math.max(2, railCount - 1);
    railsValueEl.textContent = railCount;
    renderRailFence();
  });

  renderRailFence();

})();
