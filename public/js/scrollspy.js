function selectNavItem (el) {
  $('a[href^="#"]').removeClass('selected');
  $(el).addClass('selected');
};

$(document).ready(function () {
  $('a[href^="#"]').click(function (e) {
    e.preventDefault();
    var targetId = e.currentTarget.href.split('#')[1];
    var $targetEl = $('#' + targetId);
    $('body').scrollTop($targetEl.offset().top - 80);
  });
});