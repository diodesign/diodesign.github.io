/* utility functions for site */

function run_sketch(sketchSrc) {
  var thumbnail = document.getElementById("sketchThumbnail");
  var iframe = document.createElement('iframe');
  iframe.setAttribute("src", sketchSrc);
  iframe.width = thumbnail.width;
  iframe.height = thumbnail.height;
  iframe.style.border = "none";

  var button = document.getElementById("sketchButton");
  button.remove();
  thumbnail.replaceWith(iframe);
}