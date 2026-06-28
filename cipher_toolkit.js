(function(){
  "use strict";

  // ===========================================================
  // Cipher Toolkit
  //
  // Six independent widgets, one per cipher. None of them solve a
  // message on their own - they only show the mechanics (an alphabet
  // mapping, a grid, a square) so the person using them still has to
  // do the actual reading and reasoning themselves.
  //
  // Layout: each widget below is self-contained (own state, own
  // render function, own event listeners), so sections can be read
  // and edited independently of each other.
  // ===========================================================

  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // ===================== THEME TOGGLE =====================
  // "Dark mode, or dark mode?" - both options are dark, only the
  // phosphor colour changes. The actual theme switch is just one
  // attribute (data-theme on <html>); the head script applies any
  // saved choice immediately on load, before first paint, so there's
  // no flash of the wrong theme.
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

  // Sync the switch's position with whatever the head script already
  // applied (or the default, if nothing was saved).
  setTheme(document.documentElement.getAttribute("data-theme") === "amber" ? "amber" : "green");

  // ===================== CAESAR WHEEL =====================
  // Two concentric rings of letters drawn as SVG <text> elements.
  // The outer ring is fixed (always A-Z in order, A at the top) and
  // represents plaintext. The inner ring represents ciphertext: as
  // the shift changes, each inner letter's position is recalculated
  // so the ring appears to rotate, while every letter stays upright
  // (we move each letter's x/y instead of rotating the whole group,
  // which is what stops the letters tilting as the wheel turns).

  const cx = 150, cy = 150; // centre of the SVG viewBox
  const outerR = 118, innerR = 68; // ring radii, in SVG user units

  // Returns the {x, y} position of the point at the given fractional
  // position (index / total) around a circle of the given radius,
  // measured clockwise starting from the top (12 o'clock).
  function pointOnCircle(index, total, radius){
    const angle = (index / total) * 2 * Math.PI; // 0 = top, clockwise
    const x = cx + radius * Math.sin(angle);
    const y = cy - radius * Math.cos(angle);
    return { x, y };
  }

  // Creates the 26 <text> elements for one ring and appends them to
  // the given SVG <g> group. Called once per ring at startup; after
  // that, only positions (not the elements themselves) are updated.
  function buildRing(groupId, radius, className){
    const group = document.getElementById(groupId);
    group.innerHTML = "";
    for(let i = 0; i < 26; i++){
      const { x, y } = pointOnCircle(i, 26, radius);
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x.toFixed(1));
      text.setAttribute("y", y.toFixed(1));
      text.setAttribute("class", "ring-letter " + className);
      text.setAttribute("data-letter-index", i);
      text.textContent = A[i];
      group.appendChild(text);
    }
  }

  buildRing("outerRingGroup", outerR, "");
  buildRing("innerRingGroup", innerR, "inner");

  // Proper modulo for negative numbers, e.g. mod26(-1) === 25.
  // JavaScript's % operator returns a negative result for a negative
  // input (-1 % 26 === -1), which isn't what we want when the shift
  // itself can be negative.
  function mod26(n){ return ((n % 26) + 26) % 26; }

  // Moves each inner-ring letter to the position it should occupy at
  // the given shift, without rotating the letter itself. Letter j
  // (A=0, B=1, ...) needs to sit at the slot that ends up aligned
  // with outer letter A when the wheel is shifted forward by `shift`,
  // which works out to slot (j - shift) mod 26.
  function repositionInnerRing(shift){
    const innerLetters = document.querySelectorAll("#innerRingGroup .ring-letter");
    innerLetters.forEach(textEl => {
      const j = parseInt(textEl.getAttribute("data-letter-index"), 10);
      const slot = mod26(j - shift);
      const { x, y } = pointOnCircle(slot, 26, innerR);
      textEl.setAttribute("x", x.toFixed(1));
      textEl.setAttribute("y", y.toFixed(1));
    });
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let displayShift = 3; // the shift value currently shown on the wheel (can be mid-animation, hence a float)
  let animFrame = null; // handle for the in-progress requestAnimationFrame loop, if any


  // Smoothly moves the wheel from its current displayed shift to
  // `targetShift` over 400ms, easing out towards the end. If the
  // person prefers reduced motion, we skip the animation and jump
  // straight there instead.
  function animateWheelTo(targetShift){
    if(prefersReducedMotion){
      displayShift = targetShift;
      repositionInnerRing(displayShift);
      return;
    }
    if(animFrame) cancelAnimationFrame(animFrame);
    const startVal = displayShift;
    const startTime = performance.now();
    const duration = 400;
    function step(now){
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      displayShift = startVal + (targetShift - startVal) * eased;
      repositionInnerRing(displayShift);
      if(t < 1){
        animFrame = requestAnimationFrame(step);
      } else {
        displayShift = targetShift; // snap exactly to the target, avoiding any float drift
        animFrame = null;
      }
    }
    animFrame = requestAnimationFrame(step);
  }

  // Rebuilds the two-row "plaintext above / ciphertext below" table
  // that sits underneath the wheel - this is the authoritative,
  // always-exact readout; the wheel itself is just the illustration.
  function renderMapping(shift){
    const s = mod26(shift);
    const table = document.getElementById("mapTable");
    table.innerHTML = "";
    const topRow = document.createElement("tr");
    const bottomRow = document.createElement("tr");
    for(let i = 0; i < 26; i++){
      const topCell = document.createElement("td");
      topCell.textContent = A[i];
      topRow.appendChild(topCell);

      const bottomCell = document.createElement("td");
      bottomCell.textContent = A[(i + s) % 26];
      bottomRow.appendChild(bottomCell);
    }
    table.appendChild(topRow);
    table.appendChild(bottomRow);
  }

  // Called whenever the shift changes (slider drag, +/- buttons, or
  // keyboard). Updates the text readouts immediately, then kicks off
  // the wheel animation and mapping table refresh.
  function updateWheel(shift){
    shift = Math.max(-25, Math.min(25, shift));
    document.getElementById("shiftSlider").value = shift;
    document.getElementById("shiftLabel").textContent =
      "Shift: " + (shift >= 0 ? "+" : "") + shift;

    // Shifts outside -25..25 aren't offered by the slider, but a shift
    // can still be a non-reduced value like -5 (vs. its equivalent,
    // +21) - showing that equivalence is a small nod to the modular
    // arithmetic used in the Python task this toolkit supports.
    const normalized = mod26(shift);
    if(normalized !== shift && normalized !== 0){
      document.getElementById("shiftEquiv").textContent =
        "(same as a shift of +" + normalized + ")";
    } else {
      document.getElementById("shiftEquiv").textContent = "";
    }

    animateWheelTo(shift);
    renderMapping(shift);
  }

  const slider = document.getElementById("shiftSlider");
  slider.addEventListener("input", () => updateWheel(parseInt(slider.value, 10)));
  document.getElementById("shiftUp").addEventListener("click", () => updateWheel(parseInt(slider.value, 10) + 1));
  document.getElementById("shiftDown").addEventListener("click", () => updateWheel(parseInt(slider.value, 10) - 1));

  updateWheel(3);

  // ===================== SUBSTITUTION MAPPER =====================
  // `guesses` holds the person's own working mapping, keyed by
  // ciphertext letter (e.g. guesses["Q"] = "T" means "I think Q
  // stands for T"). Nothing here is pre-filled or suggested - every
  // entry comes from what the person types in.
  const subGrid = document.getElementById("subGrid");
  const guesses = {};

  // Build the 26 (label, input) cells once at startup.
  A.split("").forEach(letter => {
    const cell = document.createElement("div");
    cell.className = "sub-cell";

    const label = document.createElement("div");
    label.className = "cipher-letter";
    label.textContent = letter;

    const input = document.createElement("input");
    input.setAttribute("maxlength", "1");
    input.setAttribute("data-letter", letter);
    input.setAttribute("aria-label", letter + " maps to");

    input.addEventListener("input", () => {
      // Force single-letter, uppercase input as the person types.
      const val = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      input.value = val;
      if(val){
        guesses[letter] = val;
      } else {
        delete guesses[letter];
      }
      checkCollisions();
      renderSubPreview();
    });

    cell.appendChild(label);
    cell.appendChild(input);
    subGrid.appendChild(cell);
  });

  // A substitution cipher is a one-to-one mapping, so two ciphertext
  // letters can never legitimately guess the same plaintext letter.
  // This scans the current guesses for any guessed letter used more
  // than once, and flags every input box involved.
  function checkCollisions(){
    const seen = {};
    const collisionLetters = new Set();
    Object.entries(guesses).forEach(([cipherLetter, guess]) => {
      if(seen[guess]){
        collisionLetters.add(guess);
      }
      seen[guess] = true;
    });

    let anyCollision = false;
    subGrid.querySelectorAll("input").forEach(input => {
      const guess = guesses[input.getAttribute("data-letter")];
      if(guess && collisionLetters.has(guess)){
        input.classList.add("collision");
        anyCollision = true;
      } else {
        input.classList.remove("collision");
      }
    });

    document.getElementById("subCollisionNote").textContent = anyCollision
      ? "Two ciphertext letters can't map to the same letter\u2014check the highlighted boxes."
      : "";
  }

  // Applies the current guesses to whatever ciphertext has been
  // pasted in, character by character. Letters with no guess yet are
  // shown dimmed (via the "unmapped" class) rather than substituted,
  // so it's obvious at a glance how much of the message is still
  // unresolved. Case and non-letter characters (spaces, punctuation)
  // are preserved as-is.
  function renderSubPreview(){
    const raw = document.getElementById("subCipherInput").value;
    const preview = document.getElementById("subPreview");

    if(!raw.trim()){
      preview.textContent = "Your working decode will appear here.";
      return;
    }

    let html = "";
    for(const ch of raw){
      const upper = ch.toUpperCase();
      if(upper >= "A" && upper <= "Z"){
        const guess = guesses[upper];
        if(guess){
          const out = (ch === upper) ? guess : guess.toLowerCase();
          html += escapeHtml(out);
        } else {
          html += '<span class="unmapped">' + escapeHtml(ch) + '</span>';
        }
      } else {
        html += escapeHtml(ch);
      }
    }
    preview.innerHTML = html;
  }

  // Minimal HTML-escaping for text we're about to insert via
  // innerHTML - this is pasted-in text from the page itself (not sent
  // anywhere), but escaping it is good practice regardless.
  function escapeHtml(str){
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.getElementById("subCipherInput").addEventListener("input", renderSubPreview);

  // ===================== TRANSPOSITION GRID =====================
  // A fixed teaching example showing how columnar transposition works:
  // letters are written into a grid row by row, then read out column
  // by column. The person adjusts the number of columns to see how the
  // grid changes - the actual solving of their ciphertext is left to them.
  const TRANS_EXAMPLE = "HEREISASECRETMESSAGE";
  const rowsValueEl = document.getElementById("rowsValue");
  let rows = 3;

  function renderTransGrid(){
    const text = TRANS_EXAMPLE;
    const grid = document.getElementById("transGrid");
    grid.innerHTML = "";

    // `rows` here controls number of columns (we renamed the label in the
    // HTML to "columns" but kept the variable name for minimal diff).
    const cols = rows;
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

  document.getElementById("rowsUp").addEventListener("click", () => {
    rows = Math.min(8, rows + 1);
    rowsValueEl.textContent = rows;
    renderTransGrid();
  });
  document.getElementById("rowsDown").addEventListener("click", () => {
    rows = Math.max(2, rows - 1);
    rowsValueEl.textContent = rows;
    renderTransGrid();
  });

  renderTransGrid();

  // ===================== FREQUENCY CHART =====================
  // Static reference data: standard letter frequencies in English
  // text (percentages), most common first. Purely informational - no
  // interactivity, just rendered once at startup.
  const freqData = [
    ["E",12.7],["T",9.1],["A",8.2],["O",7.5],["I",7.0],["N",6.7],
    ["S",6.3],["H",6.1],["R",6.0],["D",4.3],["L",4.0],["C",2.8],
    ["U",2.8],["M",2.4],["W",2.4],["F",2.2],["G",2.0],["Y",2.0],
    ["P",1.9],["B",1.5],["V",1.0],["K",0.8],["J",0.15],["X",0.15],
    ["Q",0.10],["Z",0.07]
  ];
  const maxFreq = freqData[0][1]; // used to scale every bar relative to the most common letter
  const freqChart = document.getElementById("freqChart");
  freqData.forEach(([letter, pct]) => {
    const row = document.createElement("div");
    row.className = "freq-row";

    const letterEl = document.createElement("div");
    letterEl.textContent = letter;

    const track = document.createElement("div");
    track.className = "freq-bar-track";
    const fill = document.createElement("div");
    fill.className = "freq-bar-fill";
    fill.style.width = (pct / maxFreq * 100) + "%";
    track.appendChild(fill);

    const pctEl = document.createElement("div");
    pctEl.textContent = pct.toFixed(1) + "%";

    row.appendChild(letterEl);
    row.appendChild(track);
    row.appendChild(pctEl);
    freqChart.appendChild(row);
  });

  // ===================== ATBASH TABLE =====================
  // Static reference: letter i pairs with letter (25 - i), which is
  // exactly the alphabet read backwards underneath itself.
  const atbashTable = document.getElementById("atbashTable");
  const topRow = document.createElement("tr");
  const bottomRow = document.createElement("tr");
  A.split("").forEach(letter => {
    const top = document.createElement("td");
    top.textContent = letter;
    topRow.appendChild(top);

    const bottom = document.createElement("td");
    bottom.textContent = A[25 - A.indexOf(letter)];
    bottomRow.appendChild(bottom);
  });
  atbashTable.appendChild(topRow);
  atbashTable.appendChild(bottomRow);

  // ===================== VIGENÈRE TABULA RECTA =====================
  // The classic 26x26 Vigenère square: row r is the alphabet shifted
  // forward by r places (i.e. exactly a Caesar shift of r). Row
  // labels down the left and column labels across the top let you
  // look up "row = keyword letter, column = plaintext letter" to find
  // the ciphertext letter at their intersection, or work backwards
  // from a ciphertext letter to recover the plaintext column.
  const vigenereTable = document.getElementById("vigenereTable");

  // Header row: a blank corner cell, then A-Z across the top.
  const headerRow = document.createElement("tr");
  const corner = document.createElement("td");
  corner.className = "corner";
  headerRow.appendChild(corner);
  A.split("").forEach((letter, c) => {
    const th = document.createElement("td");
    th.className = "col-head";
    th.textContent = letter;
    th.setAttribute("data-col-head", c); // so hover can find this header by column index
    headerRow.appendChild(th);
  });
  vigenereTable.appendChild(headerRow);

  // 26 data rows, each one a full Caesar-shifted alphabet, labelled
  // down the left with the keyword letter it corresponds to.
  for (let r = 0; r < 26; r++) {
    const row = document.createElement("tr");
    const rowHead = document.createElement("td");
    rowHead.className = "row-head";
    rowHead.textContent = A[r];
    rowHead.setAttribute("data-row-head", r); // so hover can find this header by row index
    row.appendChild(rowHead);

    for (let c = 0; c < 26; c++) {
      const cell = document.createElement("td");
      cell.textContent = A[(c + r) % 26];
      cell.className = "vig-cell";
      cell.setAttribute("data-row", r);
      cell.setAttribute("data-col", c);
      row.appendChild(cell);
    }
    vigenereTable.appendChild(row);
  }

  // Hover guide: highlight the hovered cell plus its row and column
  // headers, so it's easy to see which row/column you're tracing.
  // Delegated on the table itself rather than per-cell, since that's
  // one listener instead of 676.
  vigenereTable.addEventListener("mouseover", (e) => {
    const cell = e.target.closest("td.vig-cell");
    if(!cell) return;
    cell.classList.add("vig-active");
    const rowHead = vigenereTable.querySelector(`[data-row-head="${cell.dataset.row}"]`);
    const colHead = vigenereTable.querySelector(`[data-col-head="${cell.dataset.col}"]`);
    if(rowHead) rowHead.classList.add("head-active");
    if(colHead) colHead.classList.add("head-active");
  });

  vigenereTable.addEventListener("mouseout", (e) => {
    const cell = e.target.closest("td.vig-cell");
    if(!cell) return;
    cell.classList.remove("vig-active");
    vigenereTable.querySelectorAll(".head-active").forEach(el => el.classList.remove("head-active"));
  });

  // ===================== RAIL FENCE DEMO =====================
  // This demo works in the encrypt direction: the person types a
  // plaintext phrase and picks a rail count, and the zigzag diagram
  // shows how the letters get rearranged. Understanding the encrypt
  // direction is what gives you the insight to reverse it yourself.
  const RAIL_DEFAULT = "MEETMEATMIDNIGHT";
  let railCount = 3;
  const railsValueEl = document.getElementById("railsValue");
  document.getElementById("railPhraseLabel").textContent = RAIL_DEFAULT;

  /**
   * Returns, for each character position in a message of the given
   * length, which rail (0-indexed) that position sits on when the
   * message is written in a zigzag across `rails` rows.
   *
   * The zigzag bounces between rail 0 and rail (rails - 1), so the
   * pattern repeats every `cycle` positions, where cycle is twice the
   * number of "steps" between the top and bottom rail.
   */
  function railIndexPattern(length, rails){
    if(rails === 1){
      return new Array(length).fill(0);
    }
    const cycle = 2 * (rails - 1);
    const pattern = [];
    for(let i = 0; i < length; i++){
      const positionInCycle = i % cycle;
      // first half of the cycle counts up (0, 1, 2, ...), second half
      // counts back down (..., 2, 1, 0) - that's the "fence" shape.
      pattern.push(positionInCycle < rails ? positionInCycle : cycle - positionInCycle);
    }
    return pattern;
  }

  /**
   * Encodes a plaintext using the rail fence cipher at the given rail count.
   * Shows the zigzag layout and the resulting ciphertext, so the person can
   * see how the scrambling works — they then reverse this process themselves.
   */
  function encodeRailFence(plaintext, rails){
    const railOf = railIndexPattern(plaintext.length, rails);
    // Read off rails in order to produce the ciphertext.
    let ciphertext = "";
    for(let r = 0; r < rails; r++){
      for(let c = 0; c < plaintext.length; c++){
        if(railOf[c] === r) ciphertext += plaintext[c];
      }
    }
    return { railOf, ciphertext };
  }

  /**
   * Renders the zigzag diagram for the current rail count and updates
   * the "reading the rails gives" readout with the resulting ciphertext.
   */
  function renderRailFence(){
    const plaintext = RAIL_DEFAULT;
    const { railOf, ciphertext } = encodeRailFence(plaintext, railCount);
    const length = plaintext.length;

    const gridEl = document.getElementById("railGrid");
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + length + ", 1.6rem)";
    gridEl.style.gridTemplateRows = "repeat(" + railCount + ", auto)";

    // Draw one cell per (rail, column) pair: filled where a letter
    // landed, otherwise an empty placeholder so the zigzag shape itself
    // stays visible.
    for(let r = 0; r < railCount; r++){
      for(let c = 0; c < length; c++){
        const cell = document.createElement("div");
        if(railOf[c] === r){
          cell.className = "rail-cell filled";
          cell.textContent = plaintext[c];
        } else {
          cell.className = "rail-cell empty";
          cell.textContent = "\u00B7"; // middle dot, just a visual placeholder
        }
        gridEl.appendChild(cell);
      }
    }

    document.getElementById("railReadout").textContent = ciphertext;
  }

  document.getElementById("railsUp").addEventListener("click", () => {
    railCount = Math.min(6, railCount + 1);
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
