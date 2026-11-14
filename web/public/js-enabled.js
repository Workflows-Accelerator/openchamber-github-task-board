// Runs before first paint. With scripting enabled the .no-js class is removed,
// so theme.css never reveals the sign-in fallback over a working board.
(function () {
  var root = document.documentElement;
  if (root && root.classList) root.classList.remove('no-js');
})();
