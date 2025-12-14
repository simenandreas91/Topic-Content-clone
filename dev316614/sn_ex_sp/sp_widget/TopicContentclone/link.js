function link(scope, element, attrs, controller) {
      if(controller.data.isMobileApp){
      var destroyWatcher = scope.$watch(
      function () { return element.find('.select2-choice span.select2-chosen').length; },
      function (newValue, oldValue) {
        if (newValue !== oldValue) {
          var mespSelectInputs = element.find('.select2-choice span.select2-chosen');
          if(mespSelectInputs.length == 2){
            mespSelectInputs[0].setAttribute('role', 'text');
            mespSelectInputs[1].setAttribute('role', 'text');
            destroyWatcher();
          }
        }
      }
    );
  }
}