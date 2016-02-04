var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

define(['exports', 'metal/src/index', 'metal-promise/src/promise/Promise', '../globals/globals', '../route/Route', '../screen/Screen', '../surface/Surface', 'metal-uri/src/Uri'], function (exports, _index, _Promise, _globals, _Route, _Screen, _Surface, _Uri) {
	'use strict';

	Object.defineProperty(exports, "__esModule", {
		value: true
	});

	var _Promise2 = _interopRequireDefault(_Promise);

	var _globals2 = _interopRequireDefault(_globals);

	var _Route2 = _interopRequireDefault(_Route);

	var _Screen2 = _interopRequireDefault(_Screen);

	var _Surface2 = _interopRequireDefault(_Surface);

	var _Uri2 = _interopRequireDefault(_Uri);

	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : {
			default: obj
		};
	}

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	function _possibleConstructorReturn(self, call) {
		if (!self) {
			throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
		}

		return call && ((typeof call === 'undefined' ? 'undefined' : _typeof(call)) === "object" || typeof call === "function") ? call : self;
	}

	function _inherits(subClass, superClass) {
		if (typeof superClass !== "function" && superClass !== null) {
			throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
		}

		subClass.prototype = Object.create(superClass && superClass.prototype, {
			constructor: {
				value: subClass,
				enumerable: false,
				writable: true,
				configurable: true
			}
		});
		if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	}

	var App = function (_EventEmitter) {
		_inherits(App, _EventEmitter);

		function App() {
			_classCallCheck(this, App);

			var _this = _possibleConstructorReturn(this, _EventEmitter.call(this));

			_this.activeScreen = null;
			_this.activePath = null;
			_this.basePath = '';
			_this.captureScrollPositionFromScrollEvent = true;
			_this.defaultTitle = _globals2.default.document.title;
			_this.formSelector = 'form[enctype="multipart/form-data"]:not([data-senna-off])';
			_this.linkSelector = 'a:not([data-senna-off])';
			_this.loadingCssClass = 'senna-loading';
			_this.nativeScrollRestorationSupported = 'scrollRestoration' in _globals2.default.window.history;
			_this.pendingNavigate = null;
			_this.popstateScrollLeft = 0;
			_this.popstateScrollTop = 0;
			_this.routes = [];
			_this.screens = {};
			_this.scrollHandle = null;
			_this.skipLoadPopstate = false;
			_this.surfaces = {};
			_this.updateScrollPosition = true;
			_this.appEventHandlers_ = new _index.EventHandler();

			_this.appEventHandlers_.add(_index.dom.on(_globals2.default.window, 'scroll', _this.onScroll_.bind(_this)), _index.dom.on(_globals2.default.window, 'load', _this.onLoad_.bind(_this)), _index.dom.on(_globals2.default.window, 'popstate', _this.onPopstate_.bind(_this)));

			_this.on('startNavigate', _this.onStartNavigate_);

			_this.on('beforeNavigate', _this.onBeforeNavigate_, true);

			_this.setLinkSelector(_this.linkSelector);

			_this.setFormSelector(_this.formSelector);

			return _this;
		}

		App.prototype.addRoutes = function addRoutes(routes) {
			var _this2 = this;

			if (!Array.isArray(routes)) {
				routes = [routes];
			}

			routes.forEach(function (route) {
				if (!(route instanceof _Route2.default)) {
					route = new _Route2.default(route.path, route.handler);
				}

				_this2.routes.push(route);
			});
			return this;
		};

		App.prototype.addSurfaces = function addSurfaces(surfaces) {
			var _this3 = this;

			if (!Array.isArray(surfaces)) {
				surfaces = [surfaces];
			}

			surfaces.forEach(function (surface) {
				if (_index.core.isString(surface)) {
					surface = new _Surface2.default(surface);
				}

				_this3.surfaces[surface.getId()] = surface;
			});
			return this;
		};

		App.prototype.clearScreensCache = function clearScreensCache() {
			var _this4 = this;

			Object.keys(this.screens).forEach(function (path) {
				if (path !== _this4.activePath) {
					_this4.removeScreen_(path, _this4.screens[path]);
				}
			});
		};

		App.prototype.createScreenInstance = function createScreenInstance(path, route) {
			var cachedScreen;

			if (path === this.activePath) {
				console.log('Already at destination, refresh navigation');
				cachedScreen = this.screens[path];
				delete this.screens[path];
			}

			var screen = this.screens[path];

			if (!screen) {
				console.log('Create screen for [' + path + ']');
				var handler = route.getHandler();

				if (handler === _Screen2.default || _Screen2.default.isImplementedBy(handler.prototype)) {
					screen = new handler();
				} else {
					screen = handler(route) || new _Screen2.default();
				}

				if (cachedScreen) {
					screen.addCache(cachedScreen.getCache());
				}
			}

			return screen;
		};

		App.prototype.disposeInternal = function disposeInternal() {
			if (this.activeScreen) {
				this.removeScreen_(this.activePath, this.activeScreen);
			}

			this.clearScreensCache();
			this.formEventHandler_.removeListener();
			this.linkEventHandler_.removeListener();
			this.appEventHandlers_.removeAllListeners();

			_EventEmitter.prototype.disposeInternal.call(this);
		};

		App.prototype.dispatch = function dispatch() {
			var currentPath = _globals2.default.window.location.pathname + _globals2.default.window.location.search + _globals2.default.window.location.hash;
			return this.navigate(currentPath, true);
		};

		App.prototype.doNavigate_ = function doNavigate_(path, opt_replaceHistory) {
			var _this5 = this;

			if (this.activeScreen && this.activeScreen.beforeDeactivate()) {
				this.pendingNavigate = _Promise2.default.reject(new _Promise2.default.CancellationError('Cancelled by active screen'));
				return this.pendingNavigate;
			}

			var route = this.findRoute(path);

			if (!route) {
				this.pendingNavigate = _Promise2.default.reject(new _Promise2.default.CancellationError('No route for ' + path));
				return this.pendingNavigate;
			}

			console.log('Navigate to [' + path + ']');
			var nextScreen = this.createScreenInstance(path, route);
			return nextScreen.load(path).then(function () {
				if (_this5.activeScreen) {
					_this5.activeScreen.deactivate();
				}

				_this5.prepareNavigateHistory_(path, nextScreen, opt_replaceHistory);

				_this5.prepareNavigateSurfaces_(nextScreen, _this5.surfaces);

				return nextScreen.flip(_this5.surfaces);
			}).then(function () {
				return _this5.syncScrollPositionSyncThenAsync_();
			}).then(function () {
				return _this5.finalizeNavigate_(path, nextScreen);
			}).catch(function (reason) {
				_this5.handleNavigateError_(path, nextScreen, reason);

				throw reason;
			});
		};

		App.prototype.finalizeNavigate_ = function finalizeNavigate_(path, nextScreen) {
			nextScreen.activate();

			if (this.activeScreen && !this.activeScreen.isCacheable()) {
				this.removeScreen_(this.activePath, this.activeScreen);
			}

			this.activePath = path;
			this.activeScreen = nextScreen;
			this.screens[path] = nextScreen;
			_globals2.default.capturedFormElement = null;
			console.log('Navigation done');
		};

		App.prototype.findRoute = function findRoute(path) {
			if (path.lastIndexOf('#') > -1 && this.isPathCurrentBrowserPath(path)) {
				return null;
			}

			path = this.maybeRemovePathHashbang(path).substr(this.basePath.length);

			for (var i = 0; i < this.routes.length; i++) {
				var route = this.routes[i];

				if (route.matchesPath(path)) {
					return route;
				}
			}

			return null;
		};

		App.prototype.getBasePath = function getBasePath() {
			return this.basePath;
		};

		App.prototype.getDefaultTitle = function getDefaultTitle() {
			return this.defaultTitle;
		};

		App.prototype.getFormSelector = function getFormSelector() {
			return this.formSelector;
		};

		App.prototype.getLinkSelector = function getLinkSelector() {
			return this.linkSelector;
		};

		App.prototype.getLoadingCssClass = function getLoadingCssClass() {
			return this.loadingCssClass;
		};

		App.prototype.getUpdateScrollPosition = function getUpdateScrollPosition() {
			return this.updateScrollPosition;
		};

		App.prototype.handleNavigateError_ = function handleNavigateError_(path, nextScreen, err) {
			console.log('Navigation error for [' + nextScreen + '] (' + err + ')');
			this.removeScreen_(path, nextScreen);
		};

		App.prototype.hasRoutes = function hasRoutes() {
			return this.routes.length > 0;
		};

		App.prototype.isPathCurrentBrowserPath = function isPathCurrentBrowserPath(path) {
			if (path) {
				return this.maybeRemovePathHashbang(path) === _globals2.default.window.location.pathname + _globals2.default.window.location.search;
			}

			return false;
		};

		App.prototype.isHtml5HistorySupported = function isHtml5HistorySupported() {
			return _globals2.default.window.history && _globals2.default.window.history.pushState;
		};

		App.prototype.isLinkSameOrigin_ = function isLinkSameOrigin_(hostname) {
			return hostname === _globals2.default.window.location.hostname;
		};

		App.prototype.isSameBasePath_ = function isSameBasePath_(path) {
			return path.indexOf(this.basePath) === 0;
		};

		App.prototype.lockHistoryScrollPosition_ = function lockHistoryScrollPosition_() {
			var state = _globals2.default.window.history.state;

			if (!state) {
				return;
			}

			var winner = false;

			var switchScrollPositionRace = function switchScrollPositionRace() {
				_globals2.default.document.removeEventListener('scroll', switchScrollPositionRace, false);

				if (!winner) {
					_globals2.default.window.scrollTo(state.scrollLeft, state.scrollTop);

					winner = true;
				}
			};

			_index.async.nextTick(switchScrollPositionRace);

			_globals2.default.document.addEventListener('scroll', switchScrollPositionRace, false);
		};

		App.prototype.maybeDisableNativeScrollRestoration = function maybeDisableNativeScrollRestoration() {
			if (this.nativeScrollRestorationSupported) {
				this.nativeScrollRestoration_ = _globals2.default.window.history.scrollRestoration;
				_globals2.default.window.history.scrollRestoration = 'manual';
			}
		};

		App.prototype.maybeNavigateToLinkElement_ = function maybeNavigateToLinkElement_(href, event) {
			var uri = new _Uri2.default(href);
			var path = uri.getPathname() + uri.getSearch() + uri.getHash();

			if (!this.isLinkSameOrigin_(uri.getHostname())) {
				console.log('Offsite link clicked');
				return false;
			}

			if (!this.isSameBasePath_(path)) {
				console.log('Link clicked outside app\'s base path');
				return false;
			}

			if (!this.findRoute(path)) {
				console.log('No route for ' + path);
				return false;
			}

			var navigateFailed = false;

			try {
				this.navigate(path);
			} catch (err) {
				navigateFailed = true;
			}

			if (!navigateFailed) {
				event.preventDefault();
			}

			return true;
		};

		App.prototype.maybeRemovePathHashbang = function maybeRemovePathHashbang(path) {
			var hashIndex = path.lastIndexOf('#');

			if (hashIndex > -1) {
				path = path.substr(0, hashIndex);
			}

			return path;
		};

		App.prototype.maybeRepositionScrollToHashedAnchor = function maybeRepositionScrollToHashedAnchor() {
			var hash = _globals2.default.window.location.hash;

			if (hash) {
				var anchorElement = _globals2.default.document.getElementById(hash.substring(1));

				if (anchorElement) {
					_globals2.default.window.scrollTo(anchorElement.offsetLeft, anchorElement.offsetTop);
				}
			}
		};

		App.prototype.maybeRestoreNativeScrollRestoration = function maybeRestoreNativeScrollRestoration() {
			if (this.nativeScrollRestorationSupported && this.nativeScrollRestoration_) {
				_globals2.default.window.history.scrollRestoration = this.nativeScrollRestoration_;
			}
		};

		App.prototype.navigate = function navigate(path, opt_replaceHistory) {
			if (!this.isHtml5HistorySupported()) {
				throw new Error('HTML5 History is not supported. Senna will not intercept navigation.');
			}

			if (path === this.activePath) {
				opt_replaceHistory = true;
			}

			this.emit('beforeNavigate', {
				path: path,
				replaceHistory: !!opt_replaceHistory
			});
			return this.pendingNavigate;
		};

		App.prototype.onBeforeNavigate_ = function onBeforeNavigate_(event) {
			this.emit('startNavigate', {
				path: event.path,
				replaceHistory: event.replaceHistory
			});
		};

		App.prototype.onDocClickDelegate_ = function onDocClickDelegate_(event) {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.button) {
				console.log('Navigate aborted, invalid mouse button or modifier key pressed.');
				return;
			}

			this.maybeNavigateToLinkElement_(event.delegateTarget.href, event);
		};

		App.prototype.onDocSubmitDelegate_ = function onDocSubmitDelegate_(event) {
			var form = event.delegateTarget;

			if (form.method === 'get') {
				console.log('GET method not supported');
				return;
			}

			if (this.maybeNavigateToLinkElement_(form.action, event)) {
				_globals2.default.capturedFormElement = form;
			}
		};

		App.prototype.onLoad_ = function onLoad_() {
			var _this6 = this;

			this.skipLoadPopstate = true;
			setTimeout(function () {
				_this6.skipLoadPopstate = false;
			}, 0);
			this.maybeRepositionScrollToHashedAnchor();
		};

		App.prototype.onPopstate_ = function onPopstate_(event) {
			if (this.skipLoadPopstate) {
				return;
			}

			var state = event.state;

			if (!state) {
				if (_globals2.default.window.location.hash) {
					if (this.activePath && !this.isPathCurrentBrowserPath(this.activePath)) {
						this.reloadPage();
					}

					this.maybeRepositionScrollToHashedAnchor();
				} else {
					this.reloadPage();
				}

				return;
			}

			if (state.senna) {
				console.log('History navigation to [' + state.path + ']');
				this.popstateScrollTop = state.scrollTop;
				this.popstateScrollLeft = state.scrollLeft;

				if (!this.nativeScrollRestorationSupported) {
					this.lockHistoryScrollPosition_();
				}

				this.navigate(state.path, true);
			}
		};

		App.prototype.onScroll_ = function onScroll_() {
			if (this.captureScrollPositionFromScrollEvent) {
				this.saveHistoryCurrentPageScrollPosition_();
			}
		};

		App.prototype.onStartNavigate_ = function onStartNavigate_(event) {
			var _this7 = this;

			this.maybeDisableNativeScrollRestoration();
			this.captureScrollPositionFromScrollEvent = false;
			var endPayload = {};

			if (_globals2.default.capturedFormElement) {
				event.form = _globals2.default.capturedFormElement;
				endPayload.form = _globals2.default.capturedFormElement;
			}

			var documentElement = _globals2.default.document.documentElement;

			_index.dom.addClasses(documentElement, this.loadingCssClass);

			this.stopPendingNavigate_();
			this.pendingNavigate = this.doNavigate_(event.path, event.replaceHistory).catch(function (err) {
				endPayload.error = err;
				throw err;
			}).thenAlways(function () {
				endPayload.path = event.path;

				_index.dom.removeClasses(documentElement, _this7.loadingCssClass);

				_this7.maybeRestoreNativeScrollRestoration();

				_this7.captureScrollPositionFromScrollEvent = true;

				_this7.emit('endNavigate', endPayload);
			});
		};

		App.prototype.prefetch = function prefetch(path) {
			var _this8 = this;

			var route = this.findRoute(path);

			if (!route) {
				return _Promise2.default.reject(new _Promise2.default.CancellationError('No route for ' + path));
			}

			console.log('Prefetching [' + path + ']');
			var nextScreen = this.createScreenInstance(path, route);
			return nextScreen.load(path).then(function () {
				return _this8.screens[path] = nextScreen;
			}).catch(function (reason) {
				_this8.handleNavigateError_(path, nextScreen, reason);

				throw reason;
			});
		};

		App.prototype.prepareNavigateHistory_ = function prepareNavigateHistory_(path, nextScreen, opt_replaceHistory) {
			var title = nextScreen.getTitle();

			if (!_index.core.isString(title)) {
				title = this.getDefaultTitle();
			}

			var historyState = {
				form: _index.core.isDefAndNotNull(_globals2.default.capturedFormElement),
				navigatePath: path,
				path: nextScreen.beforeUpdateHistoryPath(path),
				senna: true,
				scrollTop: 0,
				scrollLeft: 0
			};

			if (opt_replaceHistory) {
				historyState.scrollTop = this.popstateScrollTop;
				historyState.scrollLeft = this.popstateScrollLeft;
			}

			this.updateHistory_(title, historyState.path, nextScreen.beforeUpdateHistoryState(historyState), opt_replaceHistory);
		};

		App.prototype.prepareNavigateSurfaces_ = function prepareNavigateSurfaces_(nextScreen, surfaces) {
			Object.keys(surfaces).forEach(function (id) {
				var surfaceContent = nextScreen.getSurfaceContent(id);
				surfaces[id].addContent(nextScreen.getId(), surfaceContent);
				console.log('Screen [' + nextScreen.getId() + '] add content to surface ' + '[' + surfaces[id] + '] [' + (_index.core.isDefAndNotNull(surfaceContent) ? '...' : 'empty') + ']');
			});
		};

		App.prototype.reloadPage = function reloadPage() {
			_globals2.default.window.location.reload();
		};

		App.prototype.removeRoute = function removeRoute(route) {
			return _index.array.remove(this.routes, route);
		};

		App.prototype.removeScreen_ = function removeScreen_(path, screen) {
			var _this9 = this;

			Object.keys(this.surfaces).forEach(function (surfaceId) {
				return _this9.surfaces[surfaceId].remove(screen.getId());
			});
			screen.dispose();
			delete this.screens[path];
		};

		App.prototype.saveHistoryCurrentPageScrollPosition_ = function saveHistoryCurrentPageScrollPosition_() {
			var state = _globals2.default.window.history.state;

			if (state && state.senna) {
				state.scrollTop = _globals2.default.window.pageYOffset;
				state.scrollLeft = _globals2.default.window.pageXOffset;

				_globals2.default.window.history.replaceState(state, null, null);
			}
		};

		App.prototype.setBasePath = function setBasePath(basePath) {
			this.basePath = basePath;
		};

		App.prototype.setDefaultTitle = function setDefaultTitle(defaultTitle) {
			this.defaultTitle = defaultTitle;
		};

		App.prototype.setFormSelector = function setFormSelector(formSelector) {
			this.formSelector = formSelector;

			if (this.formEventHandler_) {
				this.formEventHandler_.removeListener();
			}

			this.formEventHandler_ = _index.dom.delegate(document, 'submit', this.formSelector, this.onDocSubmitDelegate_.bind(this));
		};

		App.prototype.setLinkSelector = function setLinkSelector(linkSelector) {
			this.linkSelector = linkSelector;

			if (this.linkEventHandler_) {
				this.linkEventHandler_.removeListener();
			}

			this.linkEventHandler_ = _index.dom.delegate(document, 'click', this.linkSelector, this.onDocClickDelegate_.bind(this));
		};

		App.prototype.setLoadingCssClass = function setLoadingCssClass(loadingCssClass) {
			this.loadingCssClass = loadingCssClass;
		};

		App.prototype.setUpdateScrollPosition = function setUpdateScrollPosition(updateScrollPosition) {
			this.updateScrollPosition = updateScrollPosition;
		};

		App.prototype.stopPendingNavigate_ = function stopPendingNavigate_() {
			if (this.pendingNavigate) {
				this.pendingNavigate.cancel('Cancel pending navigation');
				this.pendingNavigate = null;
			}
		};

		App.prototype.syncScrollPositionSyncThenAsync_ = function syncScrollPositionSyncThenAsync_() {
			var _this10 = this;

			var state = _globals2.default.window.history.state;

			if (!state) {
				return;
			}

			var scrollTop = state.scrollTop;
			var scrollLeft = state.scrollLeft;

			var sync = function sync() {
				if (_this10.updateScrollPosition) {
					_globals2.default.window.scrollTo(scrollLeft, scrollTop);
				}
			};

			return new _Promise2.default(function (resolve) {
				return sync() & _index.async.nextTick(function () {
					return sync() & resolve();
				});
			});
		};

		App.prototype.updateHistory_ = function updateHistory_(title, path, state, opt_replaceHistory) {
			if (opt_replaceHistory) {
				_globals2.default.window.history.replaceState(state, title, path);
			} else {
				_globals2.default.window.history.pushState(state, title, path);
			}

			_globals2.default.document.title = title;
		};

		return App;
	}(_index.EventEmitter);

	App.prototype.registerMetalComponent && App.prototype.registerMetalComponent(App, 'App')
	exports.default = App;
});
//# sourceMappingURL=App.js.map