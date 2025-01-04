window.HELP_IMPROVE_VIDEOJS = false;

$(document).ready(function () {
  // Check for click events on the navbar burger icon

  var options = {
    slidesToScroll: 1,
    slidesToShow: 1,
    loop: true,
    infinite: true,
    autoplay: true,
    autoplaySpeed: 5000,
  };

  // Initialize all div with carousel class
  var carousels = bulmaCarousel.attach('.carousel', options);

  bulmaSlider.attach();
});

function toggleCollapse(id) {
  const element = document.getElementById(id);
  if (element.style.display === 'none' || element.style.display === '') {
    element.style.display = 'flex';
  } else {
    element.style.display = 'none';
  }
}
