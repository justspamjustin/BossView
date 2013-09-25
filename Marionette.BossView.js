/**
 * https://github.com/justspamjustin/BossView
 * BossView v 0.1.1
 * Extend from BossView for the following conveniences:
 *
 * - Specify your views in the 'subViews' object.  The key becomes the instance of the subView on the
 *   parent view.  On the right, you can either specify a function and initialize your view manually,
 *   returning the instance, or just specify the view class and BossView will initialize it for you.
 *   Example:
 * - subViews: {
 *    subViewName: function () {
 *        return new SomeView({
 *          size: 'small'
 *        });
 *    },
 *    // or
 *    otherSubViewName: SomeOtherView
 * }
 *
 * - subViews should only communicate to its parent view through events.  The 'subViewEvents' object
 *   allows you to treat your subView events in the same way you would handle dom events with the
 *   'events' object.  If you want to listen to all subviews for an event, just use the '*' character
 *    for the subViewName.
 *   Example:
 * - subViewEvents: {
 *    'subViewName subview:event': 'eventHandlerCallback'
 * }
 *
 * - Sometimes you will want to render your subViews inside of a containing element of your BossView.
 *   Do this by implementing the 'subViewContainers' object.  The key should correspond the name of the
 *   subView that you specified in the 'subViews' object.  The key is the jQuery selector of the
 *   containing element.
 *
 * - subViewContainers: {
 *  subViewName: '.sub-view-container'
 * }
 *
 * - Sometimes you may want to have all of the subViews render inside one parent div without
 *   having to specify the same subView container for each subView.  To do this, just specify a
 *   jQuery selector for the 'mainSubViewContainer' property.
 *
 * - mainSubViewContainer: '.sub-view-container'
 *
 * - Sometimes you may want to only render your subViews under some condition.  In this case, provide
 *   a 'subViewRenderConditions' hash.  Define a function that
 *   returns truthy or falsey.
 *
 * - subViewRenderConditions: {
 *     subViewName: function () {
 *      return this.collection.length > 0;
 *     }
 *   }
 *
 * - SubView Event Bubbling
 *   BossView will automatically bubble up the events of your subviews.  It will be prepended with the
 *   name of the subview.  For example, if your subview was named 'buttonView', and it triggered a 'select'
 *   event. The parent view would trigger a 'buttonView:select' event.
 */

Backbone.Marionette.BossView = Backbone.Marionette.ItemView.extend({
  
  template: function () { return ''; },
  
  constructor: function () {
    Backbone.Marionette.ItemView.prototype.constructor.apply(this, arguments);
    this._initializeSubViews();
    this._initializeChildViewEvents();
    this._initializeSubViewEventBubbling();
    this.listenTo(this, 'render', this._onParentRendered);
  },

  getParentEl: function () {
    return this.$el;
  },

  _initializeSubViews: function () {
    this._eachSubView(_.bind(function (subViewName, subViewFunction) {
      var subView = this._getInitializedSubView(subViewFunction);
      this._checkSubViewForRender(subView, subViewName);
      this[subViewName] = subView;
    }, this));
  },

  _getInitializedSubView: function (subViewFunction) {
    var subView;
    var isRenderableView = _.isFunction(subViewFunction.prototype.render);
    if (isRenderableView) {
      subView = this._initializeRenderableSubView(subViewFunction);
    } else {
      subView = subViewFunction.call(this);
    }
    return subView;
  },

  _initializeRenderableSubView: function (subViewFunction) {
    return new subViewFunction({
      model: this.model,
      collection: this.collection
    });
  },

  _checkSubViewForRender: function (subView, subViewName) {
    if (_.isUndefined(subView) || !_.isFunction(subView.render)) {
      throw new Error('The subview named ' + subViewName + ' does not have a render function.');
    }
  },

  _initializeChildViewEvents: function () {
    this._eachSubViewEvent(_.bind(function (subView, subViewEventName, subViewEventCallback) {
      subViewEventCallback = this._getSubViewEventCallbackFunction(subViewEventCallback, subViewEventName);
      if (subView === '*') {
        this._listenToEventOnAllSubViews(subViewEventCallback, subViewEventName);
      } else {
        this.listenTo(subView, subViewEventName, subViewEventCallback);
      }
    }, this));
  },

  _getSubViewEventCallbackFunction: function (subViewEventCallback, subViewEventName) {
    if (_.isString(subViewEventCallback)) {
      this._checkForSubViewEventCallback(subViewEventCallback, subViewEventName);
      subViewEventCallback = this[subViewEventCallback];
    }
    return subViewEventCallback;
  },

  _listenToEventOnAllSubViews: function (subViewEventCallback, subViewEventName) {
    this._eachSubView(_.bind(function (subViewName) {
      var subViewInstance = this[subViewName];
      this.listenTo(subViewInstance, subViewEventName, subViewEventCallback);
    }, this));
  },

  _checkForSubViewEventCallback: function (subViewEventCallback, subViewEventName) {
    if (_.isUndefined(this[subViewEventCallback])) {
      throw new Error('This view has no function named ' + subViewEventCallback + ' to use as a callback for the event ' + subViewEventName);
    }
  },

  _initializeSubViewEventBubbling: function () {
    this._eachSubView(_.bind(function (subViewName) {
      var subView = this[subViewName];
      this.listenTo(subView, 'all', function () {
        this.trigger(subViewName + ':' + arguments[0], arguments[1]);
      });
    }, this));
  },

  _onParentRendered: function () {
    this._renderSubViews();
  },

  _renderSubViews: function () {
    this._eachSubView(_.bind(function (subViewName) {
      var appendToEl = this.getParentEl();
      if (this._hasSubViewContainer(subViewName)) {
        appendToEl = this._getSubViewContainer(subViewName);
      } else if (this._getMainSubViewContainer()) {
        appendToEl = this.$(this._getMainSubViewContainer());
      }
      this._renderSubView(subViewName, appendToEl);
    }, this));
  },

  _renderSubView: function (subViewName, appendToEl) {
    if (this._shouldRenderSubView(subViewName)) {
      this[subViewName].render().$el.appendTo(appendToEl);
      /**
       * We need to call delegateEvents here because when Marionette renders a template
       * it uses this.$el.html(templateHTML).  If this is the second render, then it will
       * remove each of the subViews from the DOM, thus also unbinding each of their DOM
       * events.  So this is necessary for any renders after the initial render.
       */
      this[subViewName].delegateEvents();
    }
  },

  _shouldRenderSubView: function (subViewName) {
    var renderConditionFunction = this._getSubViewRenderConditions()[subViewName];
    var hasRenderConditionFunction = _.isFunction(renderConditionFunction);
    return  hasRenderConditionFunction ? renderConditionFunction.call(this) : true;
  },

  _eachSubView: function (callback) {
    if (this._getSubViews()) {
      for (var subViewName in this._getSubViews()) {
        callback(subViewName, this._getSubViews()[subViewName]);
      }
    }
  },

  _eachSubViewEvent: function (callback) {
    if (this._getSubViewEvents()) {
      for (var subViewEventKey in this._getSubViewEvents()) {
        var split = this._splitSubViewEventKey(subViewEventKey);
        this._checkSubViewExistsForEvents(split.subViewName);
        var subView = split.subViewName === '*' ? '*' : this[split.subViewName];
        callback(subView, split.subViewEventName, this._getSubViewEvents()[subViewEventKey]);
      }
    }
  },

  _splitSubViewEventKey: function (subViewEventKey) {
    var subViewEventKeySplit = subViewEventKey.split(' ');
    return {
      subViewName: subViewEventKeySplit[0],
      subViewEventName: subViewEventKeySplit[1]
    }
  },

  _checkSubViewExistsForEvents: function (subViewName) {
    if (subViewName !== '*' && _.isUndefined(this[subViewName])) {
      throw new Error('Subview named ' + subViewName + ' is not defined in subViews.');
    }
  },

  _hasSubViewContainer: function (subViewName) {
    return !_.isUndefined(this._getSubViewContainers()) && !_.isUndefined(this._getSubViewContainers()[subViewName]);
  },

  _getSubViewContainer: function (subViewName) {
    if (!this._hasSubViewContainer(subViewName)) {
      throw new Error('No subview container for subView: ' + subViewName);
    }
    return this.$(this._getSubViewContainers()[subViewName]);
  },

  _getSubViewContainers: function () {
    return this.subViewContainers || this.options.subViewContainers;
  },

  _getMainSubViewContainer: function () {
    return this.mainSubViewContainer || this.options.mainSubViewContainer;
  },

  _getSubViews: function () {
    var subViews = _.result(this, 'subViews');
    if (this.options.subViews) {
      subViews = _.result(this.options, 'subViews');
    }
    return subViews;
  },

  _getSubViewEvents: function () {
    return this.subViewEvents || this.options.subViewEvents;
  },

  _getSubViewRenderConditions: function () {
    return this.subViewRenderConditions || this.options.subViewRenderConditions || {};
  },

  remove: function () {
    Backbone.Marionette.ItemView.prototype.remove.apply(this, arguments);
    this._removeSubViews();
  },

  _removeSubViews: function () {
    this._eachSubView(_.bind(function (subViewName) {
      this[subViewName].remove();
    }, this));
  }

});
