/* utility functions for site */

/* run a sketch by replacing a thumbnail image on the page (sketchThumbnail) with an iframe embedding the sketch
   sketchSrc = URL of sketch to embed on the page within an iframe */
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