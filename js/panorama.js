/*
$.panorama version 1.0
by danyagrohman@gmail.com
*/

(function($){
	function Panorama(el, options) {
		//Defaults:
		// nothing mandatory
		this.defaults = {
			debug: false, //optional
			animationDuration: 500,
			animationEasing: 'easeOutExpo',
			titleSelector: 'h1',
			itemsContainerSelector: '.ui-panorama-items',
			itemSelector: '.ui-panorama-item',
			backgroundAnimationStep: 0, // for dynamic value not specify this option
			titleAnimationStep: 15,
			itemsGapPercentage: 10,
			itemsLeftMarginPercent: 0,
			totalNumberOfItems: 0, // for dynamic value not specify this option
			controlInitializedEventName: 'controlInitialized',
			selectedItemChangedEventName: 'selectedItemChanged'
		};

		//Extending options:
		this.opts = $.extend({}, this.defaults, options);
		this.opts = $.extend(this.opts, {
			currentIndex: 0,
			busy:false,
			_item_width: 0,
			eventsSettings: {
				useSetReleaseCapture: false,
				lastXYById: {}
			},
			debug: this.opts.debug == true && $('<div>').css({
				'position':'fixed',
				'bottom':'0px',
				'right':'0px',
				'background':'white',
				'border':'1px solid red',
				'overflow':'hidden',
				'width':'200px',
				'height':'20%',
				'zIndex':'9999'
			}).appendTo('body')
		})

		if(parseInt(this.opts.backgroundAnimationStep)==0) this.opts.backgroundAnimationStep = Math.round(100/$(el).find(this.opts.itemSelector).length);
		if(parseInt(this.opts.totalNumberOfItems)==0) this.opts.totalNumberOfItems = $(el).find(this.opts.itemSelector).length;

		if(this.opts.debug){
			var hrefContainer = $('<div>').css({
				'position':'fixed',
				'bottom':'0px',
				'left':'0px',
				'background':'white',
				'border':'1px solid red'
			}).appendTo('body');
			$('<h2>').html('<a href="#" onclick="$(\'.ui-panorama\').data(\'obj\').goToNext();">swipe left</a>').appendTo(hrefContainer);
			$('<h2>').html('<a href="#" onclick="$(\'.ui-panorama\').data(\'obj\').goToPrevious();">swipe right</a>').appendTo(hrefContainer);
			$('<h2>').html('<a href="#" onclick="$(\'.ui-panorama\').data(\'obj\').goTo(3);">go to screen 3</a>').appendTo(hrefContainer);
			$('<h2>').html('<a href="#" onclick="alert($(\'.ui-panorama\').data(\'obj\').opts.currentIndex);">get current idx</a>').appendTo(hrefContainer);
		}
		//Privates:
		this.$el = $(el);

		this.getItemsContainer = function(){
			return this.$el.children(this.opts.itemsContainerSelector);
		};
		this.getItems = function(){
			return this.getItemsContainer().children(this.opts.itemSelector);
		};
		this.getItem = function(index){
			return this.getItemsContainer().children(this.opts.itemSelector+':eq('+index+')')
		}
		this.getLastItem = function(){
			return this.getItem(this.opts.totalNumberOfItems-1);
		};
		this.getTitle=function() {
			return this.$el.children(this.opts.titleSelector).first();
		};

		this.fixIndex= function(index) {
			if(index < 0) {
				index += this.opts.totalNumberOfItems;
			} else if(index >= this.opts.totalNumberOfItems) {
				index -= this.opts.totalNumberOfItems;
			}
			return index;
		};
		this.getCurrentItem = function(){
			return this.getItems().eq(this.opts.currentIndex);
		};
		this.goTo=function(idx){
			var _this=this;
			var interval = setInterval(function(){
				if(_this.opts.currentIndex==idx){
					clearInterval(interval);
				} else
				if(_this.opts.currentIndex<idx){
					_this.goToNext();
				} else {
					_this.goToPrevious();
				}
			}, _this.opts.animationDuration);
		}
		this.goToNext = function(){
			this.changeItem(true);
		};
		this.goToPrevious=function(){
			this.changeItem(false);
		};

		/* gestures */
		this.setEvents = function(target){
			var parent = this;
			if (window.navigator.msPointerEnabled) {
				// Microsoft pointer model
				target.addEventListener("MSPointerDown", touchMe, false);
				target.addEventListener("MSPointerMove", touchMe, false);
				target.addEventListener("MSPointerUp", touchMe, false);
				target.addEventListener("MSPointerCancel", touchMe, false);

				// css way to prevent panning in our target area
				if (typeof target.style.msContentZooming != 'undefined') {
					target.style.msContentZooming = "none";
				}

				// new in Windows Consumer Preview: css way to prevent all built-in touch actions on our target
				// without this, you cannot touch draw on the element because IE will intercept the touch events
				if (typeof target.style.msTouchAction != 'undefined') {
					target.style.msTouchAction = "none";
				}

				parent.opts.debug && $('<div>').html('Using Microsoft pointer model').prependTo(parent.opts.debug);

			} else if (target.addEventListener) {
				//} else if ('ontouchstart' in window) {
				// iOS touch model
				target.addEventListener("touchstart", touchMe, false);
				target.addEventListener("touchmove", touchMe, false);
				target.addEventListener("touchend", touchMe, false);
				target.addEventListener("touchcancel", touchMe, false);

				// mouse model
				target.addEventListener("mousedown", touchMe, false);

				// mouse model with capture
				// rejecting gecko because, unlike ie, firefox does not send events to target when the mouse is outside target
				if (target.setCapture && !window.navigator.userAgent.match(/\bGecko\b/)) {
					this.opts.eventsSettings.useSetReleaseCapture = true;
					target.addEventListener("mousemove", touchMe, false);
					target.addEventListener("mouseup", touchMe, false);
				}
				parent.opts.debug && $('<div>').html('Using mouse model with capture').prependTo(parent.opts.debug);


			} else if (target.attachEvent && target.setCapture) {
				// legacy IE mode - mouse with capture
				opts.eventsSettings.useSetReleaseCapture = true;
				target.attachEvent("onmousedown", function () {
					touchMe(window.event);
					window.event.returnValue = false;
					return false;
				});
				target.attachEvent("onmousemove", function () {
					touchMe(window.event);
					window.event.returnValue = false;
					return false;
				});
				target.attachEvent("onmouseup", function () {
					touchMe(window.event);
					window.event.returnValue = false;
					return false;
				});

				parent.opts.debug && $('<div>').html('Using legacy IE mode - mouse model with capture').prependTo(parent.opts.debug);

			} else {
				parent.opts.debug && $('<div>').html('Unexpected combination of supported features').prependTo(parent.opts.debug);
				return false;
			}
			var curX, newX;
			function touchMe(theEvtObj){
				//	if (parent.opts.busy) {
				//		return;
				//	}
				if (theEvtObj.type == "mousemove" && parent.NumberOfKeys(parent.opts.eventsSettings.lastXYById) == 0) {
					return;
				}

				// IE10's implementation in the Windows Developer Preview requires doing all of this
				// Not all of these methods remain in the Windows Consumer Preview, hence the tests for method existence.
				if (theEvtObj.preventDefault) {
					theEvtObj.preventDefault();
				}
				if (theEvtObj.preventManipulation) {
					theEvtObj.preventManipulation();
				}

				if (theEvtObj.preventMouseEvent){
					theEvtObj.preventMouseEvent();
				}

				var pointerList = theEvtObj.changedTouches ? theEvtObj.changedTouches : [theEvtObj];
				for (var i = 0; i < pointerList.length; ++i) {
					var pointerObj = pointerList[i];
					var pointerId = (typeof pointerObj.identifier != 'undefined') ? pointerObj.identifier : (typeof pointerObj.pointerId != 'undefined') ? pointerObj.pointerId : 1;

					// use the pageX/Y coordinates to compute target-relative coordinates when we have them (in ie < 9, we need to do a little work to put them there)
					parent.EnsurePageXY(pointerObj);
					var pageX = pointerObj.pageX;
					var pageY = pointerObj.pageY;
					if (theEvtObj.type.match(/(start|down)$/i)) {
						// clause for processing MSPointerDown, touchstart, and mousedown

						// refresh the document-to-target delta on start in case the target has moved relative to document
						documentToTargetDelta = parent.ComputeDocumentToElementDelta(target);

						// protect against failing to get an up or end on this pointerId
						if (parent.opts.eventsSettings.lastXYById[pointerId]) {
							delete parent.opts.eventsSettings.lastXYById[pointerId];
							parent.opts.debug && $('<div>').html('end').prependTo(parent.opts.debug);
						}

						parent.opts.debug && $('<div>').html('start at '+pageX+'px').prependTo(parent.opts.debug);

						// init last page positions for this pointer
						parent.opts.eventsSettings.lastXYById[pointerId] = {
							x: pageX,
							y: pageY
						};

						curX=pageX;

						// in the Microsoft pointer model, set the capture for this pointer
						// in the mouse model, set the capture or add a document-level event handlers if this is our first down point
						// nothing is required for the iOS touch model because capture is implied on touchstart
						if (target.msSetPointerCapture)
							target.msSetPointerCapture(pointerId);
						else if (theEvtObj.type == "mousedown" && parent.NumberOfKeys(parent.opts.eventsSettings.lastXYById) == 1) {
							if (parent.opts.eventsSettings.useSetReleaseCapture)
								target.setCapture(true);
							else {
								document.addEventListener("mousemove", touchMe, false);
								document.addEventListener("mouseup", touchMe, false);
							}
						}
					}else if (theEvtObj.type.match(/move$/i)) {
						// clause handles mousemove, MSPointerMove, and touchmove
						parent.opts.eventsSettings.lastXYById[pointerId].x = pageX;
						parent.opts.eventsSettings.lastXYById[pointerId].y = pageY;
						newX=pageX-curX;
						var wait=20;
						if(Math.abs(newX)>wait){
							if(newX<0) wait=-wait;
							var move = newX-wait;
							parent.opts.debug && $('<div>').html('move: '+move+'px').prependTo(parent.opts.debug);
							parent.getItemsContainer().css('left', move+'px')
						} else {
							newX=0;
						}

					}
					else if (parent.opts.eventsSettings.lastXYById[pointerId] && theEvtObj.type.match(/(up|end|cancel)$/i)) {
						// clause handles up/end/cancel
						parent.opts.debug && $('<div>').html('end').prependTo(parent.opts.debug);

						// handle swipe while busy==false
						var interval = setInterval(function(){
							if (parent.opts.busy==false) {
								clearInterval(interval);
							}
							if(newX>0){
								parent.goToPrevious();
							} else if(newX<0) {
								parent.goToNext();
							}
							newX=0;

						}, 10)
						// delete last page positions for this pointer
						delete parent.opts.eventsSettings.lastXYById[pointerId];

						// in the Microsoft pointer model, release the capture for this pointer
						// in the mouse model, release the capture or remove document-level event handlers if there are no down points
						// nothing is required for the iOS touch model because capture is implied on touchstart
						if (target.msReleasePointerCapture)
							target.msReleasePointerCapture(pointerId);
						else if (theEvtObj.type == "mouseup" && parent.NumberOfKeys(parent.opts.eventsSettings.lastXYById) == 0) {
							if (parent.opts.eventsSettings.useSetReleaseCapture)
								target.releaseCapture();
							else {
								document.removeEventListener("mousemove", touchMe, false);
								document.removeEventListener("mouseup", touchMe, false);
							}
						}
					}
				}
			}

			this.$el.data("obj", parent);
			this.$el.trigger(parent.opts.controlInitializedEventName);
			return true;
		};

		this.EnsurePageXY= function(eventObj){
			// function needed because IE versions before 9 did not define pageX/Y in the MouseEvent object
			if (typeof eventObj.pageX == 'undefined') {
				// initialize assuming our source element is our target
				eventObj.pageX = eventObj.offsetX + documentToTargetDelta.x;
				eventObj.pageY = eventObj.offsetY + documentToTargetDelta.y;

				if (eventObj.srcElement.offsetParent == target && document.documentMode && document.documentMode == 8 && eventObj.type == "mousedown") {
					// source element is a child piece of VML, we're in IE8, and we've not called setCapture yet - add the origin of the source element
					eventObj.pageX += eventObj.srcElement.offsetLeft;
					eventObj.pageY += eventObj.srcElement.offsetTop;
				}
				else if (eventObj.srcElement != target && !document.documentMode || document.documentMode < 8) {
					// source element isn't the target (most likely it's a child piece of VML) and we're in a version of IE before IE8 -
					// the offsetX/Y values are unpredictable so use the clientX/Y values and adjust by the scroll offsets of its parents
					// to get the document-relative coordinates (the same as pageX/Y)
					var sx = -2, sy = -2; // adjust for old IE's 2-pixel border
					for (var scrollElement = eventObj.srcElement; scrollElement != null; scrollElement = scrollElement.parentNode) {
						sx += scrollElement.scrollLeft ? scrollElement.scrollLeft : 0;
						sy += scrollElement.scrollTop ? scrollElement.scrollTop : 0;
					}

					eventObj.pageX = eventObj.clientX + sx;
					eventObj.pageY = eventObj.clientY + sy;
				}
			}
		}

		this.NumberOfKeys = function(theObject){
			if (Object.keys)
				return Object.keys(theObject).length;

			var n = 0;
			for (var key in theObject) {
				++n;
			}

			return n;
		}
		this.ComputeDocumentToElementDelta = function(theElement){
			// we send target-relative coordinates to the draw functions
			// this calculates the delta needed to convert pageX/Y to offsetX/Y because offsetX/Y don't exist in the TouchEvent object or in Firefox's MouseEvent object
			var elementLeft = 0;
			var elementTop = 0;

			for (var offsetElement = theElement; offsetElement != null; offsetElement = offsetElement.offsetParent) {
				// the following is a major hack for versions of IE less than 8 to avoid an apparent problem on the IEBlog with double-counting the offsets
				// this may not be a general solution to IE7's problem with offsetLeft/offsetParent
				if (navigator.userAgent.match(/\bMSIE\b/) && (!document.documentMode || document.documentMode < 8) && offsetElement.currentStyle.position == "relative" && offsetElement.offsetParent && offsetElement.offsetParent.currentStyle.position == "relative" && offsetElement.offsetLeft == offsetElement.offsetParent.offsetLeft) {
					// add only the top
					elementTop += offsetElement.offsetTop;
				}
				else {
					elementLeft += offsetElement.offsetLeft;
					elementTop += offsetElement.offsetTop;
				}
			}

			return {
				x: elementLeft,
				y: elementTop
			};
		}

		this.changeItem = function(rightDirection){
			if (this.opts.busy) {
				return false;
			}

			this.opts.busy = true;

			if(this.opts.debug){
				if(rightDirection){
					$('<div>').html('swipe left').prependTo(this.opts.debug);
				} else {
					$('<div>').html('swipe right').prependTo(this.opts.debug);
				}
			}

			var rightItemIndex;
			var leftItemIndex;

			var currentItem = this.getItem(this.opts.currentIndex);
			leftItemIndex = this.fixIndex(rightDirection ? (this.opts.currentIndex + 1) : (this.opts.currentIndex - 1));
			rightItemIndex = this.fixIndex(rightDirection ? (this.opts.currentIndex + 2) : (this.opts.currentIndex + 1));

			var leftItem = this.getItem(leftItemIndex);
			var rightItem = this.totalNumberOfItems > 2 ? this.getItem(rightItemIndex) : undefined;

			if(!rightDirection && leftItem){
				leftItem.css({
					left: -this.opts._item_width+this.opts.itemsLeftMarginPercent
				});
				var preLeftItemIndex = this.fixIndex(leftItemIndex-1);
				var preLeftItem = this.getItem(preLeftItemIndex);
				this.getItems().not(":eq("+this.opts.currentIndex+")").not(":eq("+leftItemIndex+")").not(":eq("+preLeftItemIndex+")").hide();
				this.getItem(this.fixIndex(leftItemIndex-1)).css({
					left:	-this.opts._item_width+this.opts.itemsLeftMarginPercent
				})
			}
			if(rightDirection && rightItem){
				rightItem.css({
					left: 2 * this.opts._item_width+this.opts.itemsLeftMarginPercent
				});
				this.getItems().not(":eq("+this.opts.currentIndex+")").not(":eq("+rightItemIndex+")").hide();
			}

			var animationTarget = {
				left: ((rightDirection ? "-=" : "+=") + this.opts._item_width)
			};



			leftItem && leftItem.show();
			rightItem && rightItem.show();

			var parent = this;
			var onAnimationFinished = function() {
				parent.opts.currentIndex = leftItemIndex;
				parent.opts.busy = false;
				preLeftItem && preLeftItem.show();
				parent.$el.trigger(parent.opts.selectedItemChangedEventName);
			};

			leftItem && leftItem.animate(animationTarget, this.opts.animationDuration, this.opts.animationEasing, onAnimationFinished);
			rightItem && rightItem.animate(animationTarget, this.opts.animationDuration, this.opts.animationEasing);
			currentItem.animate(animationTarget, this.opts.animationDuration, this.opts.animationEasing);
			this.getItemsContainer().animate({
				'left':'0px'
			}, this.opts.anumationDuration, this.opts.animationEasing)

			this.getTitle().animate({
				marginLeft: (-leftItemIndex * this.opts.titleAnimationStep) + "%"
			}, this.opts.animationDuration, this.opts.animationEasing);
			this.$el.animate({
				'backgroundPositionX': leftItemIndex * this.opts.backgroundAnimationStep+'%'
			}, this.opts.animationDuration, this.opts.animationEasing)


			return true;
		};
	}

	// Separate functionality from object creation
	Panorama.prototype = {

		init: function() {
			var _this = this;
			var controller = _this.$el;
			if(controller.data('panorama')){
				return false;
			}
			controller.attr('data-panorama', true);
			this.prepare(controller);
			return true;
		},
		prepare: function(controller){
			/* i'm not sure why this happening, but sometimes there's a 1px lack at bottom of the page */
			var myHeight = controller.parent().height()+1;
			controller.height(myHeight);
			var unmargin = this.getItemsContainer().position().top;
			var itemsHeight = myHeight - unmargin;
			this.getItemsContainer().height(itemsHeight);


			this.totalNumberOfItems = this.getItems().length;

			var myWidth = controller.outerWidth();
			var item_width = myWidth * (100 - this.opts.itemsGapPercentage) / 100;
			this.opts._item_width = item_width;
			var itemsLeftMarginPercent = Math.round($(window).width()/100*this.opts.itemsLeftMarginPercent);
			this.opts.itemsLeftMarginPercent = itemsLeftMarginPercent;
			this.getItems().each(function (index, item) {
				// set height
				$(item).height(itemsHeight - ($(item).outerHeight() - $(item).height()));

				// set real width
				$(item).width(item_width - ($(item).outerWidth() - $(item).width()));

				// set initial visibility state
				if(index == 1) $(item).css({
					left: item_width
				});
				if(index > 1) $(item).hide();
			});
			if(this.opts.totalNumberOfItems>2){
				this.getLastItem().css({
					'left':'-'+item_width+'px'
				}).show()
				this.getItems().css('left', '+='+itemsLeftMarginPercent+'px')
			}

		},
		show: function(){
			var _this=this;
			this.getItemsContainer().fadeIn(function(){
				var unmargin = _this.getItemsContainer().position().top;
				_this.getItems().each(function () {
					$(this).css('height', '-='+unmargin+'px')
				});
			});
		}
	};

	// The actual plugin
	$.fn.panorama = function(options) {
		if(this.length) {
			this.each(function() {
				var rev = new Panorama(this, options);
				rev.init();
				rev.setEvents(this);
				rev.show();
				$(this).data('panorama', rev);
			});
		}
	};
})(jQuery);

$.easing.easeOutExpo = function (x, t, b, c, d) {
	return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
}