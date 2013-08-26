/**
 * BossView
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

define(function (require) {
  'use strict';
  var _ = require('underscore');
  var Marionette = require('marionette');
  Marionette.BossView = Marionette.ItemView.extend({
    template: function () {},
    constructor: function () {
      Marionette.ItemView.prototype.constructor.apply(this, arguments);
      this.initializeSubViews();
      this.initializeChildViewEvents();
      this.initializeSubViewEventBubbling();
      this.listenTo(this, 'render', this.onParentRendered);
    },
    
    getParentEl: function () {
      return this.$el;
    },

    initializeSubViews: function () {
      this.eachSubView(_.bind(function (subViewName, subViewFunction) {
        var subView;
        var isRenderableView = _.isFunction(subViewFunction.prototype.render);
        if (isRenderableView) {
          subView = new subViewFunction({
            model: this.model,
            collection: this.collection
          });
        } else {
          subView = subViewFunction.call(this);
        }
        if (_.isUndefined(subView) || !_.isFunction(subView.render)) {
          throw new Error('The subview named ' + subViewName + ' does not have a render function.');
        }
        this[subViewName] = subView;
      }, this));
    },

    initializeChildViewEvents: function () {
      this.eachSubViewEvent(_.bind(function (subView, subViewEventName, subViewEventCallback) {
        if (_.isString(subViewEventCallback)) {
          if (_.isUndefined(this[subViewEventCallback])) {
            throw new Error('This view has no function named ' + subViewEventCallback + ' to use as a callback for the event ' + subViewEventName);
          }
          subViewEventCallback = this[subViewEventCallback];
        }
        if (subView === '*') {
          this.eachSubView(_.bind(function (subViewName) {
            var subViewInstance = this[subViewName];
            this.listenTo(subViewInstance, subViewEventName, subViewEventCallback);
          }, this));
        } else {
          this.listenTo(subView, subViewEventName, subViewEventCallback);
        }

      }, this));
    },

    onParentRendered: function () {
      this.renderSubViews();
    },

    renderSubViews: function () {
      this.eachSubView(_.bind(function (subViewName) {
        var appendToEl = this.getParentEl();
        if (this.hasSubViewContainer(subViewName)) {
          appendToEl = this.getSubViewContainer(subViewName);
        } else if (this.getMainSubViewContainer()) {
          appendToEl = this.$(this.getMainSubViewContainer());
        }
        this.renderSubView(subViewName, appendToEl);
      }, this));
    },

    renderSubView: function (subViewName, appendToEl) {
      if (this.shouldRenderSubView(subViewName)) {
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

    shouldRenderSubView: function (subViewName) {
      var renderConditionFunction = this.getSubViewRenderConditions()[subViewName];
      var hasRenderConditionFunction = _.isFunction(renderConditionFunction);
      return  hasRenderConditionFunction ? renderConditionFunction.call(this) : true;
    },

    eachSubView: function (callback) {
      if (this.getSubViews()) {
        for (var subViewName in this.getSubViews()) {
          callback(subViewName, this.getSubViews()[subViewName]);
        }
      }
    },

    eachSubViewEvent: function (callback) {
      if (this.getSubViewEvents()) {
        for (var subViewEventKey in this.getSubViewEvents()) {
          var subViewEventKeySplit = subViewEventKey.split(' ');
          var subViewName = subViewEventKeySplit[0];
          var subViewEventName = subViewEventKeySplit[1];
          if (subViewName !== '*' && _.isUndefined(this[subViewName])) {
            throw new Error('Subview named ' + subViewName + ' is not defined in subViews.');
          }
          var subView = subViewName === '*' ? '*' : this[subViewName];
          callback(subView, subViewEventName, this.getSubViewEvents()[subViewEventKey]);
        }
      }
    },

    hasSubViewContainer: function (subViewName) {
      return !_.isUndefined(this.getSubViewContainers()) && !_.isUndefined(this.getSubViewContainers()[subViewName]);
    },

    getSubViewContainer: function (subViewName) {
      if (!this.hasSubViewContainer(subViewName)) {
        throw new Error('No subview container for subView: ' + subViewName);
      }
      return this.$(this.getSubViewContainers()[subViewName]);
    },
    
    getSubViewContainers: function () {
      return this.subViewContainers || this.options.subViewContainers;
    },
    
    getMainSubViewContainer: function () {
      return this.mainSubViewContainer || this.options.mainSubViewContainer;
    },
    
    getSubViews: function () {
      var subViews = this.callFunctionIfFunction(this.subViews);
      if (this.options.subViews) {
        subViews = this.callFunctionIfFunction(this.options.subViews);
      }
      return subViews;
    },
    
    getSubViewEvents: function () {
      return this.subViewEvents || this.options.subViewEvents;
    },

    getSubViewRenderConditions: function () {
      return this.subViewRenderConditions || this.options.subViewRenderConditions || {};
    },

    remove: function () {
      Marionette.ItemView.prototype.remove.apply(this, arguments);
      this.removeSubViews();
    },

    removeSubViews: function () {
      this.eachSubView(_.bind(function (subViewName) {
        this[subViewName].remove();
      }, this));
    },

    callFunctionIfFunction: function (property) {
      var value = property;
      if (_.isFunction(property)) {
        value = property.call(this);
      }
      return value;
    },

    initializeSubViewEventBubbling: function () {
      this.eachSubView(_.bind(function (subViewName) {
        var subView = this[subViewName];
        this.listenTo(subView, 'all', function () {
          this.trigger(subViewName + ':' + arguments[0], arguments[1]);
        });
      }, this));
    }

  });
  return Marionette.BossView;
});
