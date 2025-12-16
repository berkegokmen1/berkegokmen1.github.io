window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 240;

var interp_images = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };
  $('#interpolation-image-wrapper').empty().append(image);
}


$(document).ready(function() {
    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
      // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
      $(".navbar-burger").toggleClass("is-active");
      $(".navbar-menu").toggleClass("is-active");

    });

    var options = {
			slidesToScroll: 1,
			slidesToShow: 1,
			loop: true,
			infinite: true,
			autoplay: false,
			autoplaySpeed: 3000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);

    // Loop on each carousel initialized
    for(var i = 0; i < carousels.length; i++) {
    	// Add listener to  event
    	carousels[i].on('before:show', state => {
    		console.log(state);
    	});
    }

    // Access to bulmaCarousel instance of an element
    var element = document.querySelector('#my-element');
    if (element && element.bulmaCarousel) {
    	// bulmaCarousel instance is available as element.bulmaCarousel
    	element.bulmaCarousel.on('before-show', function(state) {
    		console.log(state);
    	});
    }

    /*var player = document.getElementById('interpolation-video');
    player.addEventListener('loadedmetadata', function() {
      $('#interpolation-slider').on('input', function(event) {
        console.log(this.value, player.duration);
        player.currentTime = player.duration / 100 * this.value;
      })
    }, false);*/
    preloadInterpolationImages();

    $('#interpolation-slider').on('input', function(event) {
      setInterpolationImage(this.value);
    });
    setInterpolationImage(0);
    $('#interpolation-slider').prop('max', NUM_INTERP_FRAMES - 1);

    bulmaSlider.attach();

    $('.glb-fullscreen').on('click', function() {
      var targetId = $(this).data('target');
      var viewer = document.getElementById(targetId);
      if (!viewer) return;
      var requestFull = viewer.requestFullscreen || viewer.webkitRequestFullscreen || viewer.mozRequestFullScreen || viewer.msRequestFullscreen;
      if (requestFull) {
        requestFull.call(viewer);
      }
    });

    // Video modal
    $('#video-modal-open').on('click', function(e) {
      e.preventDefault();
      var modal = $('#video-modal');
      modal.addClass('is-active');
      var video = document.getElementById('overlay-video');
      if (video) {
        video.play();
      }
    });
    $('#video-modal .modal-close, #video-modal .modal-background').on('click', function() {
      var modal = $('#video-modal');
      modal.removeClass('is-active');
      var video = document.getElementById('overlay-video');
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });

    // Lazy load images and model-viewers using IntersectionObserver
    if ('IntersectionObserver' in window) {
      const imgObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '200px 0px' });

      document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));

      const modelObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const mv = entry.target;
            if (mv.dataset.src) {
              mv.src = mv.dataset.src;
              mv.removeAttribute('data-src');
            }
            observer.unobserve(mv);
          }
        });
      }, { rootMargin: '200px 0px' });

      document.querySelectorAll('model-viewer[data-src]').forEach(mv => modelObserver.observe(mv));
    }

})
