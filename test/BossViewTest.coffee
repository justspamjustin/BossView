expect = chai.expect
BossView = Backbone.Marionette.BossView

describe 'BossView', ->
  testView = null
  beforeEach ->
    TestView = BossView.extend
      subViews:
        testSubView: Backbone.View
        testSubView2: ->
          return new Backbone.View()
    testView = new TestView

  describe '#constructor', ->
    it 'Should initialize each subView', ->
      expect(testView.testSubView).to.be.an.instanceOf(Backbone.View)
      expect(testView.testSubView2).to.be.an.instanceOf(Backbone.View)

    it 'Should throw if the provided subview is not renderable', ->
      TestView = BossView.extend
        subViews:
          testSubView: ->

      shouldThrow = ->
        testView = new TestView()

      expect(shouldThrow).to.throw('testSubView does not have a render function')

    it 'Should listen to subView events if there are subViewEvents defined', ->
      eventSpy = sinon.spy()
      TestView = BossView.extend
        subViews:
          testSubView: Backbone.View
        subViewEvents:
          'testSubView someevent': 'onSomeEvent'
        onSomeEvent: ->
          eventSpy()

      testView = new TestView()
      testView.testSubView.trigger('someevent')
      expect(eventSpy).to.be.called

    it 'should be able to listen to subView events two levels deep', ->
      eventSpy = sinon.spy()
      TestView = BossView.extend
        subViews:
          testSubView: ->
            return new BossView
              subViews:
                testInnerSubView: Backbone.View
        subViewEvents:
          'testSubView testInnerSubView:someevent': 'onSomeEvent'
        onSomeEvent: ->
          eventSpy()

      testView = new TestView()
      testView.testSubView.testInnerSubView.trigger('someevent')
      expect(eventSpy).to.be.called

    it 'Should also listen to an inline function for subViewEvents', ->
      eventSpy = sinon.spy()
      TestView = BossView.extend
        subViews:
          testSubView: Backbone.View
        subViewEvents:
          'testSubView someevent': ->
            eventSpy()

      testView = new TestView()
      testView.testSubView.trigger('someevent')
      expect(eventSpy).to.be.called

    it 'Should throw if you give it a callback name of a function that doesnt exist', ->
      TestView = BossView.extend
        subViews:
          testSubView: Backbone.View
        subViewEvents:
          'testSubView someevent': 'noFunction'

      shouldThrow = ->
        testView = new TestView()
      expect(shouldThrow).to.throw('noFunction to use as a callback')

    it 'should allow you to specify subViews as a function', ->
      TestView = BossView.extend
        subViews: ->
          return {
            testSubView: ->
              return new Backbone.View()
          }
      testView = new TestView()
      expect(testView.testSubView).to.be.an.instanceOf(Backbone.View)

  describe '#onParentRendered', ->
    beforeEach ->
      testView.render()

    it 'Should render each subView when the parent is rendered', ->
      expect(testView.$('div')).to.have.length(2)

    it 'Should render the subView in a container if it is specified', ->
      TestView = BossView.extend
        template: ->
          return """<div class="container"></div>"""
        subViews:
          testSubView: Backbone.View
        subViewContainers:
          testSubView: '.container'

      testView = new TestView()
      testView.render()
      expect(testView.$('.container').find('div')).to.have.length(1)

  describe '#remove', ->
    beforeEach ->
      testView.render()
      testView.remove()

    it 'Should remove each of the subviews as well', ->
      expect(testView.$el.html()).to.have.length(0)
      expect(testView.testSubView.$el.html()).to.have.length(0)
      expect(testView.testSubView2.$el.html()).to.have.length(0)

  describe '#render', ->
    it 'should not break the events of the child views when the parent view is re-rendered', ->
      innerViewClicked = sinon.spy()

      innerView = new BossView({
        className: 'inner-view'
        template: ->
          return 'inner'
        events:
          'click': ->
            innerViewClicked()
      })

      outerView = new BossView({
        template: ->
          return 'outer'
        subViews:
          innerView: ->
            return innerView
      })

      outerView.render().$el.appendTo($('body'))
      outerView.render()
      $('.inner-view').click()
      expect(innerViewClicked.called).to.be.true
