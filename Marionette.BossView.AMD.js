/**
 * https://github.com/justspamjustin/BossView
 * BossView v 0.1.3
 */

define(function (require) {
  'use strict';
  var _ = require('underscore');
  var Marionette = require('marionette');
  Marionette.BossView = Marionette.ItemView.extend({

    template: function () { return ''; },

    constructor: function () {
      Marionette.ItemView.prototype.constructor.apply(this, arguments);
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
      this.trigger('subviews:before:render');
      this._renderSubViews();
      this.trigger('subviews:after:render');
    },

    _renderSubViews: function () {
      var mainSubViewContainer = this._getOption('mainSubViewContainer');
      this._eachSubView(_.bind(function (subViewName) {
        var appendToEl = this.getParentEl();
        if (this._hasSubViewContainer(subViewName)) {
          appendToEl = this._getSubViewContainer(subViewName);
        } else if (mainSubViewContainer) {
          appendToEl = this.$(mainSubViewContainer);
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
      var subViewEvents = this._getOption('subViewEvents');
      if (subViewEvents) {
        for (var subViewEventKey in subViewEvents) {
          var split = this._splitSubViewEventKey(subViewEventKey);
          this._checkSubViewExistsForEvents(split.subViewName);
          var subView = split.subViewName === '*' ? '*' : this[split.subViewName];
          callback(subView, split.subViewEventName, subViewEvents[subViewEventKey]);
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
      var subViewContainers = this._getOption('subViewContainers');
      return !_.isUndefined(subViewContainers) && !_.isUndefined(subViewContainers[subViewName]);
    },

    _getSubViewContainer: function (subViewName) {
      if (!this._hasSubViewContainer(subViewName)) {
        throw new Error('No subview container for subView: ' + subViewName);
      }
      return this.$(this._getOption('subViewContainers')[subViewName]);
    },

    remove: function () {
      Marionette.ItemView.prototype.remove.apply(this, arguments);
      this._removeSubViews();
    },

    _removeSubViews: function () {
      this._eachSubView(_.bind(function (subViewName) {
        this[subViewName].remove();
      }, this));
    },

    _getSubViews: function () {
      var subViews = _.result(this, 'subViews');
      if (this.options.subViews) {
        subViews = _.result(this.options, 'subViews');
      }
      return subViews;
    },

    _getOption: function (optionName) {
      return this[optionName] || this.options[optionName];
    },

    _getSubViewRenderConditions: function () {
      return this._getOption('subViewRenderConditions') || {};
    }
  });
  return Marionette.BossView;
});
