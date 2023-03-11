
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    // Adapted from https://github.com/then/is-promise/blob/master/index.js
    // Distributed under MIT License https://github.com/then/is-promise/blob/master/LICENSE
    function is_promise(value) {
        return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function update_await_block_branch(info, ctx, dirty) {
        const child_ctx = ctx.slice();
        const { resolved } = info;
        if (info.current === info.then) {
            child_ctx[info.value] = resolved;
        }
        if (info.current === info.catch) {
            child_ctx[info.error] = resolved;
        }
        info.block.p(child_ctx, dirty);
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const parseNumber = parseFloat;

    function joinCss(obj, separator = ';') {
      let texts;
      if (Array.isArray(obj)) {
        texts = obj.filter((text) => text);
      } else {
        texts = [];
        for (const prop in obj) {
          if (obj[prop]) {
            texts.push(`${prop}:${obj[prop]}`);
          }
        }
      }
      return texts.join(separator);
    }

    function getStyles(style, size, pull, fw) {
      let float;
      let width;
      const height = '1em';
      let lineHeight;
      let fontSize;
      let textAlign;
      let verticalAlign = '-.125em';
      const overflow = 'visible';

      if (fw) {
        textAlign = 'center';
        width = '1.25em';
      }

      if (pull) {
        float = pull;
      }

      if (size) {
        if (size == 'lg') {
          fontSize = '1.33333em';
          lineHeight = '.75em';
          verticalAlign = '-.225em';
        } else if (size == 'xs') {
          fontSize = '.75em';
        } else if (size == 'sm') {
          fontSize = '.875em';
        } else {
          fontSize = size.replace('x', 'em');
        }
      }

      return joinCss([
        joinCss({
          float,
          width,
          height,
          'line-height': lineHeight,
          'font-size': fontSize,
          'text-align': textAlign,
          'vertical-align': verticalAlign,
          'transform-origin': 'center',
          overflow,
        }),
        style,
      ]);
    }

    function getTransform(
      scale,
      translateX,
      translateY,
      rotate,
      flip,
      translateTimes = 1,
      translateUnit = '',
      rotateUnit = '',
    ) {
      let flipX = 1;
      let flipY = 1;

      if (flip) {
        if (flip == 'horizontal') {
          flipX = -1;
        } else if (flip == 'vertical') {
          flipY = -1;
        } else {
          flipX = flipY = -1;
        }
      }

      return joinCss(
        [
          `translate(${parseNumber(translateX) * translateTimes}${translateUnit},${parseNumber(translateY) * translateTimes}${translateUnit})`,
          `scale(${flipX * parseNumber(scale)},${flipY * parseNumber(scale)})`,
          rotate && `rotate(${rotate}${rotateUnit})`,
        ],
        ' ',
      );
    }

    /* node_modules/svelte-fa/src/fa.svelte generated by Svelte v3.55.1 */
    const file$f = "node_modules/svelte-fa/src/fa.svelte";

    // (66:0) {#if i[4]}
    function create_if_block$4(ctx) {
    	let svg;
    	let g1;
    	let g0;
    	let g1_transform_value;
    	let g1_transform_origin_value;
    	let svg_id_value;
    	let svg_class_value;
    	let svg_viewBox_value;

    	function select_block_type(ctx, dirty) {
    		if (typeof /*i*/ ctx[10][4] == 'string') return create_if_block_1$1;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			if_block.c();
    			attr_dev(g0, "transform", /*transform*/ ctx[12]);
    			add_location(g0, file$f, 81, 6, 1397);
    			attr_dev(g1, "transform", g1_transform_value = "translate(" + /*i*/ ctx[10][0] / 2 + " " + /*i*/ ctx[10][1] / 2 + ")");
    			attr_dev(g1, "transform-origin", g1_transform_origin_value = "" + (/*i*/ ctx[10][0] / 4 + " 0"));
    			add_location(g1, file$f, 77, 4, 1293);
    			attr_dev(svg, "id", svg_id_value = /*id*/ ctx[1] || undefined);
    			attr_dev(svg, "class", svg_class_value = "svelte-fa " + /*clazz*/ ctx[0] + " svelte-1cj2gr0");
    			attr_dev(svg, "style", /*s*/ ctx[11]);
    			attr_dev(svg, "viewBox", svg_viewBox_value = "0 0 " + /*i*/ ctx[10][0] + " " + /*i*/ ctx[10][1]);
    			attr_dev(svg, "aria-hidden", "true");
    			attr_dev(svg, "role", "img");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			toggle_class(svg, "pulse", /*pulse*/ ctx[4]);
    			toggle_class(svg, "spin", /*spin*/ ctx[3]);
    			add_location(svg, file$f, 66, 2, 1071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, g1);
    			append_dev(g1, g0);
    			if_block.m(g0, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(g0, null);
    				}
    			}

    			if (dirty & /*transform*/ 4096) {
    				attr_dev(g0, "transform", /*transform*/ ctx[12]);
    			}

    			if (dirty & /*i*/ 1024 && g1_transform_value !== (g1_transform_value = "translate(" + /*i*/ ctx[10][0] / 2 + " " + /*i*/ ctx[10][1] / 2 + ")")) {
    				attr_dev(g1, "transform", g1_transform_value);
    			}

    			if (dirty & /*i*/ 1024 && g1_transform_origin_value !== (g1_transform_origin_value = "" + (/*i*/ ctx[10][0] / 4 + " 0"))) {
    				attr_dev(g1, "transform-origin", g1_transform_origin_value);
    			}

    			if (dirty & /*id*/ 2 && svg_id_value !== (svg_id_value = /*id*/ ctx[1] || undefined)) {
    				attr_dev(svg, "id", svg_id_value);
    			}

    			if (dirty & /*clazz*/ 1 && svg_class_value !== (svg_class_value = "svelte-fa " + /*clazz*/ ctx[0] + " svelte-1cj2gr0")) {
    				attr_dev(svg, "class", svg_class_value);
    			}

    			if (dirty & /*s*/ 2048) {
    				attr_dev(svg, "style", /*s*/ ctx[11]);
    			}

    			if (dirty & /*i*/ 1024 && svg_viewBox_value !== (svg_viewBox_value = "0 0 " + /*i*/ ctx[10][0] + " " + /*i*/ ctx[10][1])) {
    				attr_dev(svg, "viewBox", svg_viewBox_value);
    			}

    			if (dirty & /*clazz, pulse*/ 17) {
    				toggle_class(svg, "pulse", /*pulse*/ ctx[4]);
    			}

    			if (dirty & /*clazz, spin*/ 9) {
    				toggle_class(svg, "spin", /*spin*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(66:0) {#if i[4]}",
    		ctx
    	});

    	return block;
    }

    // (89:8) {:else}
    function create_else_block$3(ctx) {
    	let path0;
    	let path0_d_value;
    	let path0_fill_value;
    	let path0_fill_opacity_value;
    	let path0_transform_value;
    	let path1;
    	let path1_d_value;
    	let path1_fill_value;
    	let path1_fill_opacity_value;
    	let path1_transform_value;

    	const block = {
    		c: function create() {
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", path0_d_value = /*i*/ ctx[10][4][0]);
    			attr_dev(path0, "fill", path0_fill_value = /*secondaryColor*/ ctx[6] || /*color*/ ctx[2] || 'currentColor');

    			attr_dev(path0, "fill-opacity", path0_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*primaryOpacity*/ ctx[7]
    			: /*secondaryOpacity*/ ctx[8]);

    			attr_dev(path0, "transform", path0_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path0, file$f, 90, 10, 1678);
    			attr_dev(path1, "d", path1_d_value = /*i*/ ctx[10][4][1]);
    			attr_dev(path1, "fill", path1_fill_value = /*primaryColor*/ ctx[5] || /*color*/ ctx[2] || 'currentColor');

    			attr_dev(path1, "fill-opacity", path1_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*secondaryOpacity*/ ctx[8]
    			: /*primaryOpacity*/ ctx[7]);

    			attr_dev(path1, "transform", path1_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path1, file$f, 96, 10, 1935);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path0, anchor);
    			insert_dev(target, path1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*i*/ 1024 && path0_d_value !== (path0_d_value = /*i*/ ctx[10][4][0])) {
    				attr_dev(path0, "d", path0_d_value);
    			}

    			if (dirty & /*secondaryColor, color*/ 68 && path0_fill_value !== (path0_fill_value = /*secondaryColor*/ ctx[6] || /*color*/ ctx[2] || 'currentColor')) {
    				attr_dev(path0, "fill", path0_fill_value);
    			}

    			if (dirty & /*swapOpacity, primaryOpacity, secondaryOpacity*/ 896 && path0_fill_opacity_value !== (path0_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*primaryOpacity*/ ctx[7]
    			: /*secondaryOpacity*/ ctx[8])) {
    				attr_dev(path0, "fill-opacity", path0_fill_opacity_value);
    			}

    			if (dirty & /*i*/ 1024 && path0_transform_value !== (path0_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path0, "transform", path0_transform_value);
    			}

    			if (dirty & /*i*/ 1024 && path1_d_value !== (path1_d_value = /*i*/ ctx[10][4][1])) {
    				attr_dev(path1, "d", path1_d_value);
    			}

    			if (dirty & /*primaryColor, color*/ 36 && path1_fill_value !== (path1_fill_value = /*primaryColor*/ ctx[5] || /*color*/ ctx[2] || 'currentColor')) {
    				attr_dev(path1, "fill", path1_fill_value);
    			}

    			if (dirty & /*swapOpacity, secondaryOpacity, primaryOpacity*/ 896 && path1_fill_opacity_value !== (path1_fill_opacity_value = /*swapOpacity*/ ctx[9] != false
    			? /*secondaryOpacity*/ ctx[8]
    			: /*primaryOpacity*/ ctx[7])) {
    				attr_dev(path1, "fill-opacity", path1_fill_opacity_value);
    			}

    			if (dirty & /*i*/ 1024 && path1_transform_value !== (path1_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path1, "transform", path1_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path0);
    			if (detaching) detach_dev(path1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(89:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:8) {#if typeof i[4] == 'string'}
    function create_if_block_1$1(ctx) {
    	let path;
    	let path_d_value;
    	let path_fill_value;
    	let path_transform_value;

    	const block = {
    		c: function create() {
    			path = svg_element("path");
    			attr_dev(path, "d", path_d_value = /*i*/ ctx[10][4]);
    			attr_dev(path, "fill", path_fill_value = /*color*/ ctx[2] || /*primaryColor*/ ctx[5] || 'currentColor');
    			attr_dev(path, "transform", path_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")");
    			add_location(path, file$f, 83, 10, 1461);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, path, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*i*/ 1024 && path_d_value !== (path_d_value = /*i*/ ctx[10][4])) {
    				attr_dev(path, "d", path_d_value);
    			}

    			if (dirty & /*color, primaryColor*/ 36 && path_fill_value !== (path_fill_value = /*color*/ ctx[2] || /*primaryColor*/ ctx[5] || 'currentColor')) {
    				attr_dev(path, "fill", path_fill_value);
    			}

    			if (dirty & /*i*/ 1024 && path_transform_value !== (path_transform_value = "translate(" + /*i*/ ctx[10][0] / -2 + " " + /*i*/ ctx[10][1] / -2 + ")")) {
    				attr_dev(path, "transform", path_transform_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(path);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(83:8) {#if typeof i[4] == 'string'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$f(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[10][4] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*i*/ ctx[10][4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Fa', slots, []);
    	let { class: clazz = '' } = $$props;
    	let { id = '' } = $$props;
    	let { style = '' } = $$props;
    	let { icon } = $$props;
    	let { size = '' } = $$props;
    	let { color = '' } = $$props;
    	let { fw = false } = $$props;
    	let { pull = '' } = $$props;
    	let { scale = 1 } = $$props;
    	let { translateX = 0 } = $$props;
    	let { translateY = 0 } = $$props;
    	let { rotate = '' } = $$props;
    	let { flip = false } = $$props;
    	let { spin = false } = $$props;
    	let { pulse = false } = $$props;
    	let { primaryColor = '' } = $$props;
    	let { secondaryColor = '' } = $$props;
    	let { primaryOpacity = 1 } = $$props;
    	let { secondaryOpacity = 0.4 } = $$props;
    	let { swapOpacity = false } = $$props;
    	let i;
    	let s;
    	let transform;

    	$$self.$$.on_mount.push(function () {
    		if (icon === undefined && !('icon' in $$props || $$self.$$.bound[$$self.$$.props['icon']])) {
    			console.warn("<Fa> was created without expected prop 'icon'");
    		}
    	});

    	const writable_props = [
    		'class',
    		'id',
    		'style',
    		'icon',
    		'size',
    		'color',
    		'fw',
    		'pull',
    		'scale',
    		'translateX',
    		'translateY',
    		'rotate',
    		'flip',
    		'spin',
    		'pulse',
    		'primaryColor',
    		'secondaryColor',
    		'primaryOpacity',
    		'secondaryOpacity',
    		'swapOpacity'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Fa> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('class' in $$props) $$invalidate(0, clazz = $$props.class);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('style' in $$props) $$invalidate(13, style = $$props.style);
    		if ('icon' in $$props) $$invalidate(14, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(15, size = $$props.size);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fw' in $$props) $$invalidate(16, fw = $$props.fw);
    		if ('pull' in $$props) $$invalidate(17, pull = $$props.pull);
    		if ('scale' in $$props) $$invalidate(18, scale = $$props.scale);
    		if ('translateX' in $$props) $$invalidate(19, translateX = $$props.translateX);
    		if ('translateY' in $$props) $$invalidate(20, translateY = $$props.translateY);
    		if ('rotate' in $$props) $$invalidate(21, rotate = $$props.rotate);
    		if ('flip' in $$props) $$invalidate(22, flip = $$props.flip);
    		if ('spin' in $$props) $$invalidate(3, spin = $$props.spin);
    		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
    		if ('primaryColor' in $$props) $$invalidate(5, primaryColor = $$props.primaryColor);
    		if ('secondaryColor' in $$props) $$invalidate(6, secondaryColor = $$props.secondaryColor);
    		if ('primaryOpacity' in $$props) $$invalidate(7, primaryOpacity = $$props.primaryOpacity);
    		if ('secondaryOpacity' in $$props) $$invalidate(8, secondaryOpacity = $$props.secondaryOpacity);
    		if ('swapOpacity' in $$props) $$invalidate(9, swapOpacity = $$props.swapOpacity);
    	};

    	$$self.$capture_state = () => ({
    		getStyles,
    		getTransform,
    		clazz,
    		id,
    		style,
    		icon,
    		size,
    		color,
    		fw,
    		pull,
    		scale,
    		translateX,
    		translateY,
    		rotate,
    		flip,
    		spin,
    		pulse,
    		primaryColor,
    		secondaryColor,
    		primaryOpacity,
    		secondaryOpacity,
    		swapOpacity,
    		i,
    		s,
    		transform
    	});

    	$$self.$inject_state = $$props => {
    		if ('clazz' in $$props) $$invalidate(0, clazz = $$props.clazz);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('style' in $$props) $$invalidate(13, style = $$props.style);
    		if ('icon' in $$props) $$invalidate(14, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(15, size = $$props.size);
    		if ('color' in $$props) $$invalidate(2, color = $$props.color);
    		if ('fw' in $$props) $$invalidate(16, fw = $$props.fw);
    		if ('pull' in $$props) $$invalidate(17, pull = $$props.pull);
    		if ('scale' in $$props) $$invalidate(18, scale = $$props.scale);
    		if ('translateX' in $$props) $$invalidate(19, translateX = $$props.translateX);
    		if ('translateY' in $$props) $$invalidate(20, translateY = $$props.translateY);
    		if ('rotate' in $$props) $$invalidate(21, rotate = $$props.rotate);
    		if ('flip' in $$props) $$invalidate(22, flip = $$props.flip);
    		if ('spin' in $$props) $$invalidate(3, spin = $$props.spin);
    		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
    		if ('primaryColor' in $$props) $$invalidate(5, primaryColor = $$props.primaryColor);
    		if ('secondaryColor' in $$props) $$invalidate(6, secondaryColor = $$props.secondaryColor);
    		if ('primaryOpacity' in $$props) $$invalidate(7, primaryOpacity = $$props.primaryOpacity);
    		if ('secondaryOpacity' in $$props) $$invalidate(8, secondaryOpacity = $$props.secondaryOpacity);
    		if ('swapOpacity' in $$props) $$invalidate(9, swapOpacity = $$props.swapOpacity);
    		if ('i' in $$props) $$invalidate(10, i = $$props.i);
    		if ('s' in $$props) $$invalidate(11, s = $$props.s);
    		if ('transform' in $$props) $$invalidate(12, transform = $$props.transform);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*icon*/ 16384) {
    			$$invalidate(10, i = icon && icon.icon || [0, 0, '', [], '']);
    		}

    		if ($$self.$$.dirty & /*style, size, pull, fw*/ 237568) {
    			$$invalidate(11, s = getStyles(style, size, pull, fw));
    		}

    		if ($$self.$$.dirty & /*scale, translateX, translateY, rotate, flip*/ 8126464) {
    			$$invalidate(12, transform = getTransform(scale, translateX, translateY, rotate, flip, 512));
    		}
    	};

    	return [
    		clazz,
    		id,
    		color,
    		spin,
    		pulse,
    		primaryColor,
    		secondaryColor,
    		primaryOpacity,
    		secondaryOpacity,
    		swapOpacity,
    		i,
    		s,
    		transform,
    		style,
    		icon,
    		size,
    		fw,
    		pull,
    		scale,
    		translateX,
    		translateY,
    		rotate,
    		flip
    	];
    }

    class Fa extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {
    			class: 0,
    			id: 1,
    			style: 13,
    			icon: 14,
    			size: 15,
    			color: 2,
    			fw: 16,
    			pull: 17,
    			scale: 18,
    			translateX: 19,
    			translateY: 20,
    			rotate: 21,
    			flip: 22,
    			spin: 3,
    			pulse: 4,
    			primaryColor: 5,
    			secondaryColor: 6,
    			primaryOpacity: 7,
    			secondaryOpacity: 8,
    			swapOpacity: 9
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Fa",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get class() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get icon() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fw() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fw(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pull() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pull(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get scale() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set scale(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translateX() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translateX(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get translateY() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set translateY(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get flip() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set flip(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get spin() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set spin(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pulse() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pulse(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primaryColor() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primaryColor(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondaryColor() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondaryColor(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get primaryOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set primaryOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get secondaryOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set secondaryOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get swapOpacity() {
    		throw new Error("<Fa>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set swapOpacity(value) {
    		throw new Error("<Fa>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var faCircleChevronRight = {
      prefix: 'fas',
      iconName: 'circle-chevron-right',
      icon: [512, 512, ["chevron-circle-right"], "f138", "M0 256a256 256 0 1 0 512 0A256 256 0 1 0 0 256zM241 377c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l87-87-87-87c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0L345 239c9.4 9.4 9.4 24.6 0 33.9L241 377z"]
    };
    var faPencil = {
      prefix: 'fas',
      iconName: 'pencil',
      icon: [512, 512, [9999, 61504, "pencil-alt"], "f303", "M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"]
    };
    var faSquareMinus = {
      prefix: 'fas',
      iconName: 'square-minus',
      icon: [448, 512, [61767, "minus-square"], "f146", "M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm88 200H296c13.3 0 24 10.7 24 24s-10.7 24-24 24H152c-13.3 0-24-10.7-24-24s10.7-24 24-24z"]
    };
    var faCirclePlay = {
      prefix: 'fas',
      iconName: 'circle-play',
      icon: [512, 512, [61469, "play-circle"], "f144", "M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zM188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9V344c0 8.7 4.7 16.7 12.3 20.9s16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88c-7.4-4.5-16.7-4.7-24.3-.5z"]
    };
    var faCameraRetro = {
      prefix: 'fas',
      iconName: 'camera-retro',
      icon: [512, 512, [128247], "f083", "M220.6 121.2L271.1 96 448 96v96H333.2c-21.9-15.1-48.5-24-77.2-24s-55.2 8.9-77.2 24H64V128H192c9.9 0 19.7-2.3 28.6-6.8zM0 128V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H271.1c-9.9 0-19.7 2.3-28.6 6.8L192 64H160V48c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16l0 16C28.7 64 0 92.7 0 128zM168 304a88 88 0 1 1 176 0 88 88 0 1 1 -176 0z"]
    };
    var faHeart = {
      prefix: 'fas',
      iconName: 'heart',
      icon: [512, 512, [128153, 128154, 128155, 128156, 128420, 129293, 129294, 129505, 9829, 10084, 61578], "f004", "M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z"]
    };
    var faVolumeHigh = {
      prefix: 'fas',
      iconName: 'volume-high',
      icon: [640, 512, [128266, "volume-up"], "f028", "M533.6 32.5C598.5 85.3 640 165.8 640 256s-41.5 170.8-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"]
    };
    var faVolumeUp = faVolumeHigh;
    var faPhoneFlip = {
      prefix: 'fas',
      iconName: 'phone-flip',
      icon: [512, 512, [128381, "phone-alt"], "f879", "M347.1 24.6c7.7-18.6 28-28.5 47.4-23.2l88 24C499.9 30.2 512 46 512 64c0 247.4-200.6 448-448 448c-18 0-33.8-12.1-38.6-29.5l-24-88c-5.3-19.4 4.6-39.7 23.2-47.4l96-40c16.3-6.8 35.2-2.1 46.3 11.6L207.3 368c70.4-33.3 127.4-90.3 160.7-160.7L318.7 167c-13.7-11.2-18.4-30-11.6-46.3l40-96z"]
    };
    var faPhoneAlt = faPhoneFlip;
    var faEnvelope = {
      prefix: 'fas',
      iconName: 'envelope',
      icon: [512, 512, [128386, 9993, 61443], "f0e0", "M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"]
    };
    var faVolumeOff = {
      prefix: 'fas',
      iconName: 'volume-off',
      icon: [320, 512, [], "f026", "M320 64c0-12.6-7.4-24-18.9-29.2s-25-3.1-34.4 5.3L131.8 160H64c-35.3 0-64 28.7-64 64v64c0 35.3 28.7 64 64 64h67.8L266.7 471.9c9.4 8.4 22.9 10.4 34.4 5.3S320 460.6 320 448V64z"]
    };
    var faXmark = {
      prefix: 'fas',
      iconName: 'xmark',
      icon: [320, 512, [128473, 10005, 10006, 10060, 215, "close", "multiply", "remove", "times"], "f00d", "M310.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L160 210.7 54.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L114.7 256 9.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 301.3 265.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L205.3 256 310.6 150.6z"]
    };
    var faCircleChevronLeft = {
      prefix: 'fas',
      iconName: 'circle-chevron-left',
      icon: [512, 512, ["chevron-circle-left"], "f137", "M512 256A256 256 0 1 0 0 256a256 256 0 1 0 512 0zM271 135c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-87 87 87 87c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L167 273c-9.4-9.4-9.4-24.6 0-33.9L271 135z"]
    };

    /* src/audio.svelte generated by Svelte v3.55.1 */
    const file$e = "src/audio.svelte";

    // (23:0) {:else}
    function create_else_block$2(ctx) {
    	let fa;
    	let current;

    	fa = new Fa({
    			props: { icon: faVolumeOff },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fa.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fa, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fa, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(23:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (21:0) {#if soundOn}
    function create_if_block$3(ctx) {
    	let fa;
    	let current;

    	fa = new Fa({
    			props: { icon: faVolumeUp },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(fa.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(fa, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(fa, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(21:0) {#if soundOn}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let div;
    	let button;
    	let current_block_type_index;
    	let if_block;
    	let t;
    	let audio;
    	let source;
    	let source_src_value;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block$3, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*soundOn*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			if_block.c();
    			t = space();
    			audio = element("audio");
    			source = element("source");
    			attr_dev(button, "class", "sound svelte-2fyvmu");
    			add_location(button, file$e, 19, 4, 383);
    			attr_dev(div, "class", "bgmbar svelte-2fyvmu");
    			add_location(div, file$e, 18, 0, 358);
    			if (!src_url_equal(source.src, source_src_value = "https://docs.google.com/uc?export=download&id=1uDQhYAFMPthY9w7o_zYbLIOn13tAfDv8")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "audio/mp3");
    			add_location(source, file$e, 28, 4, 587);
    			audio.autoplay = true;
    			audio.loop = true;
    			add_location(audio, file$e, 27, 0, 545);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			if_blocks[current_block_type_index].m(button, null);
    			insert_dev(target, t, anchor);
    			insert_dev(target, audio, anchor);
    			append_dev(audio, source);
    			/*audio_binding*/ ctx[3](audio);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleSound*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(button, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(audio);
    			/*audio_binding*/ ctx[3](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Audio', slots, []);
    	let bgm;
    	let soundOn = true;

    	function handleSound() {
    		if (bgm.paused) {
    			bgm.play();
    			$$invalidate(1, soundOn = true);
    		} else {
    			bgm.pause();
    			$$invalidate(1, soundOn = false);
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Audio> was created with unknown prop '${key}'`);
    	});

    	function audio_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			bgm = $$value;
    			$$invalidate(0, bgm);
    		});
    	}

    	$$self.$capture_state = () => ({
    		Fa,
    		faVolumeOff,
    		faVolumeUp,
    		bgm,
    		soundOn,
    		handleSound
    	});

    	$$self.$inject_state = $$props => {
    		if ('bgm' in $$props) $$invalidate(0, bgm = $$props.bgm);
    		if ('soundOn' in $$props) $$invalidate(1, soundOn = $$props.soundOn);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [bgm, soundOn, handleSound, audio_binding];
    }

    class Audio extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Audio",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    /* src/header.svelte generated by Svelte v3.55.1 */

    const file$d = "src/header.svelte";

    function create_fragment$d(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let span;
    	let t1;
    	let h3;
    	let t3;
    	let p;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "THE MARRIAGE";
    			t1 = space();
    			h3 = element("h3");
    			h3.textContent = "04.22";
    			t3 = space();
    			p = element("p");
    			p.textContent = "현태룡, 이초현 결혼합니다.";
    			attr_dev(span, "class", "wedding svelte-fxk55n");
    			add_location(span, file$d, 3, 3, 65);
    			attr_dev(h3, "class", "date svelte-fxk55n");
    			add_location(h3, file$d, 4, 3, 110);
    			add_location(p, file$d, 5, 3, 141);
    			attr_dev(div0, "class", "top");
    			add_location(div0, file$d, 2, 2, 44);
    			attr_dev(div1, "class", "layer");
    			add_location(div1, file$d, 1, 1, 22);
    			attr_dev(div2, "class", "header svelte-fxk55n");
    			add_location(div2, file$d, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, span);
    			append_dev(div0, t1);
    			append_dev(div0, h3);
    			append_dev(div0, t3);
    			append_dev(div0, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src/mainImg.svelte generated by Svelte v3.55.1 */

    const file$c = "src/mainImg.svelte";

    function create_fragment$c(ctx) {
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let div1;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			div1.textContent = "2023. 04. 22. Saturday 6:00 PM";
    			if (!src_url_equal(img.src, img_src_value = "https://lh3.googleusercontent.com/msAUQLSQgq7YE7rMaD22pXn_mM-I4cF9J5Gl5NlPlMxePwdW3yjjgYTdtlOCKtG1nxN6KAh76meT7gkVTQecViB3N2tPmKumSBNsNU0jFJkO0XKwj4J1PSdZLmXEXJXsvYZMPrEkPNI=w2400")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "main");
    			attr_dev(img, "width", "425px");
    			add_location(img, file$c, 5, 4, 51);
    			attr_dev(div0, "class", "mainImg svelte-2x22la");
    			add_location(div0, file$c, 4, 0, 25);
    			attr_dev(div1, "class", "bottom svelte-2x22la");
    			add_location(div1, file$c, 7, 0, 275);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, img);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MainImg', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MainImg> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class MainImg extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MainImg",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* src/greeting.svelte generated by Svelte v3.55.1 */
    const file$b = "src/greeting.svelte";

    function create_fragment$b(ctx) {
    	let div3;
    	let span;
    	let t1;
    	let div2;
    	let div0;
    	let fa;
    	let t2;
    	let div1;
    	let p;
    	let t3;
    	let br0;
    	let t4;
    	let br1;
    	let t5;
    	let br2;
    	let br3;
    	let t6;
    	let br4;
    	let t7;
    	let br5;
    	let br6;
    	let t8;
    	let br7;
    	let t9;
    	let current;

    	fa = new Fa({
    			props: { icon: faHeart, style: "color: tomato" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			span = element("span");
    			span.textContent = "인사말";
    			t1 = space();
    			div2 = element("div");
    			div0 = element("div");
    			create_component(fa.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			p = element("p");
    			t3 = text("함께 있을 때 가장 나다운 모습이 되고\n                ");
    			br0 = element("br");
    			t4 = text("\n                함께 있을 때 미래를 꿈꾸게 하는 사람을 만나\n                ");
    			br1 = element("br");
    			t5 = text("\n                함께 맞는 두 번째 봄, 결혼합니다.\n                ");
    			br2 = element("br");
    			br3 = element("br");
    			t6 = text("\n                지금처럼 서로에게 가장 친한 친구가 되어\n                ");
    			br4 = element("br");
    			t7 = text("\n                예쁘고 행복하게 잘 살겠습니다.\n                ");
    			br5 = element("br");
    			br6 = element("br");
    			t8 = text("\n                저희 두 사람의 새로운 시작을\n                ");
    			br7 = element("br");
    			t9 = text("\n                함께하시어 축복해 주시면 감사하겠습니다.");
    			attr_dev(span, "class", "title svelte-daiza7");
    			add_location(span, file$b, 6, 4, 142);
    			attr_dev(div0, "class", "mainImg svelte-daiza7");
    			add_location(div0, file$b, 8, 8, 204);
    			add_location(br0, file$b, 14, 16, 398);
    			add_location(br1, file$b, 16, 16, 461);
    			add_location(br2, file$b, 18, 16, 519);
    			add_location(br3, file$b, 18, 20, 523);
    			add_location(br4, file$b, 20, 16, 583);
    			add_location(br5, file$b, 22, 16, 638);
    			add_location(br6, file$b, 22, 20, 642);
    			add_location(br7, file$b, 24, 16, 696);
    			add_location(p, file$b, 12, 12, 340);
    			attr_dev(div1, "class", "mainText svelte-daiza7");
    			add_location(div1, file$b, 11, 8, 305);
    			attr_dev(div2, "class", "main svelte-daiza7");
    			add_location(div2, file$b, 7, 4, 177);
    			attr_dev(div3, "class", "greeting svelte-daiza7");
    			add_location(div3, file$b, 5, 0, 115);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, span);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			mount_component(fa, div0, null);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, p);
    			append_dev(p, t3);
    			append_dev(p, br0);
    			append_dev(p, t4);
    			append_dev(p, br1);
    			append_dev(p, t5);
    			append_dev(p, br2);
    			append_dev(p, br3);
    			append_dev(p, t6);
    			append_dev(p, br4);
    			append_dev(p, t7);
    			append_dev(p, br5);
    			append_dev(p, br6);
    			append_dev(p, t8);
    			append_dev(p, br7);
    			append_dev(p, t9);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(fa);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Greeting', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Greeting> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Fa, faHeart });
    	return [];
    }

    class Greeting extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Greeting",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src/calander.svelte generated by Svelte v3.55.1 */

    const file$a = "src/calander.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	child_ctx[6] = i;
    	return child_ctx;
    }

    // (47:8) {:else}
    function create_else_block$1(ctx) {
    	let td;
    	let t_value = /*date*/ ctx[4] + "";
    	let t;

    	const block = {
    		c: function create() {
    			td = element("td");
    			t = text(t_value);
    			add_location(td, file$a, 47, 20, 1163);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(47:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (45:29) 
    function create_if_block_2(ctx) {
    	let td;
    	let t_value = /*date*/ ctx[4] + "";
    	let t;

    	const block = {
    		c: function create() {
    			td = element("td");
    			t = text(t_value);
    			attr_dev(td, "class", "saturday svelte-s41r7u");
    			add_location(td, file$a, 45, 20, 1096);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(45:29) ",
    		ctx
    	});

    	return block;
    }

    // (43:29) 
    function create_if_block_1(ctx) {
    	let td;
    	let t_value = /*date*/ ctx[4] + "";
    	let t;

    	const block = {
    		c: function create() {
    			td = element("td");
    			t = text(t_value);
    			attr_dev(td, "class", "sunday svelte-s41r7u");
    			add_location(td, file$a, 43, 20, 1017);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(43:29) ",
    		ctx
    	});

    	return block;
    }

    // (41:8) {#if date == 22}
    function create_if_block$2(ctx) {
    	let td;
    	let t_value = /*date*/ ctx[4] + "";
    	let t;

    	const block = {
    		c: function create() {
    			td = element("td");
    			t = text(t_value);
    			attr_dev(td, "id", "d_day");
    			attr_dev(td, "class", "svelte-s41r7u");
    			add_location(td, file$a, 41, 20, 942);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			append_dev(td, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(41:8) {#if date == 22}",
    		ctx
    	});

    	return block;
    }

    // (40:4) {#each week as date, i}
    function create_each_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*date*/ ctx[4] == 22) return create_if_block$2;
    		if (/*i*/ ctx[6] % 7 == 0) return create_if_block_1;
    		if (/*i*/ ctx[6] % 7 == 6) return create_if_block_2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(40:4) {#each week as date, i}",
    		ctx
    	});

    	return block;
    }

    // (38:0) {#each weeks as week}
    function create_each_block$2(ctx) {
    	let tr;
    	let t;
    	let each_value_1 = /*week*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			add_location(tr, file$a, 38, 16, 864);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr, null);
    			}

    			append_dev(tr, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*weeks*/ 1) {
    				each_value_1 = /*week*/ ctx[1];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tr, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(38:0) {#each weeks as week}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let t1;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t3;
    	let th1;
    	let t5;
    	let th2;
    	let t7;
    	let th3;
    	let t9;
    	let th4;
    	let t11;
    	let th5;
    	let t13;
    	let th6;
    	let t15;
    	let tbody;
    	let each_value = /*weeks*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "4월";
    			t1 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "SUN";
    			t3 = space();
    			th1 = element("th");
    			th1.textContent = "MON";
    			t5 = space();
    			th2 = element("th");
    			th2.textContent = "TUE";
    			t7 = space();
    			th3 = element("th");
    			th3.textContent = "WED";
    			t9 = space();
    			th4 = element("th");
    			th4.textContent = "THU";
    			t11 = space();
    			th5 = element("th");
    			th5.textContent = "FRI";
    			t13 = space();
    			th6 = element("th");
    			th6.textContent = "SAT";
    			t15 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "month svelte-s41r7u");
    			add_location(div0, file$a, 21, 8, 411);
    			add_location(th0, file$a, 27, 20, 552);
    			add_location(th1, file$a, 28, 20, 585);
    			add_location(th2, file$a, 29, 20, 618);
    			add_location(th3, file$a, 30, 20, 651);
    			add_location(th4, file$a, 31, 20, 684);
    			add_location(th5, file$a, 32, 20, 717);
    			add_location(th6, file$a, 33, 20, 750);
    			add_location(tr, file$a, 26, 16, 527);
    			add_location(thead, file$a, 25, 12, 503);
    			add_location(tbody, file$a, 36, 12, 818);
    			attr_dev(table, "class", "weeks svelte-s41r7u");
    			add_location(table, file$a, 24, 8, 469);
    			attr_dev(div1, "class", "calander svelte-s41r7u");
    			add_location(div1, file$a, 20, 4, 380);
    			attr_dev(div2, "class", "calanderOutline svelte-s41r7u");
    			add_location(div2, file$a, 19, 0, 346);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			append_dev(div1, table);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t3);
    			append_dev(tr, th1);
    			append_dev(tr, t5);
    			append_dev(tr, th2);
    			append_dev(tr, t7);
    			append_dev(tr, th3);
    			append_dev(tr, t9);
    			append_dev(tr, th4);
    			append_dev(tr, t11);
    			append_dev(tr, th5);
    			append_dev(tr, t13);
    			append_dev(tr, th6);
    			append_dev(table, t15);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*weeks*/ 1) {
    				each_value = /*weeks*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function range(start, end) {
    	let array = [];

    	for (let i = start; i < end; ++i) {
    		array.push(i);
    	}

    	return array;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Calander', slots, []);

    	let weeks = [
    		['', '', '', '', '', '', 1],
    		range(2, 9),
    		range(9, 16),
    		range(16, 23),
    		range(23, 30),
    		[30]
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Calander> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ range, weeks });

    	$$self.$inject_state = $$props => {
    		if ('weeks' in $$props) $$invalidate(0, weeks = $$props.weeks);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [weeks];
    }

    class Calander extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Calander",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src/snap.svelte generated by Svelte v3.55.1 */

    const { console: console_1$3 } = globals;

    const file$9 = "src/snap.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i];
    	child_ctx[18] = i;
    	return child_ctx;
    }

    // (88:4) {:else}
    function create_else_block(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			attr_dev(img, "class", "image svelte-3jp53y");
    			if (!src_url_equal(img.src, img_src_value = /*img*/ ctx[16])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$9, 89, 20, 4419);
    			attr_dev(div, "class", "snap-image svelte-3jp53y");
    			set_style(div, "margin-right", "5px");
    			add_location(div, file$9, 88, 16, 4348);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(88:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (84:4) {#if i%5 == 4}
    function create_if_block$1(ctx) {
    	let div;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			attr_dev(img, "class", "image svelte-3jp53y");
    			if (!src_url_equal(img.src, img_src_value = /*img*/ ctx[16])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$9, 85, 20, 4260);
    			attr_dev(div, "class", "snap-image svelte-3jp53y");
    			add_location(div, file$9, 84, 16, 4215);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(84:4) {#if i%5 == 4}",
    		ctx
    	});

    	return block;
    }

    // (82:0) {#each imgs as img, i}
    function create_each_block$1(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*i*/ ctx[18] % 5 == 4) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler() {
    		return /*click_handler*/ ctx[12](/*i*/ ctx[18]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			if_block.c();
    			t = space();
    			attr_dev(button, "class", "snap-bnt svelte-3jp53y");
    			add_location(button, file$9, 82, 12, 4121);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			if_block.m(button, null);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(82:0) {#each imgs as img, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div5;
    	let div0;
    	let fa0;
    	let t0;
    	let t1;
    	let div4;
    	let div2;
    	let button0;
    	let fa1;
    	let t2;
    	let button1;
    	let fa2;
    	let t3;
    	let div1;
    	let img;
    	let img_src_value;
    	let div1_resize_listener;
    	let t4;
    	let div3;
    	let current;
    	let mounted;
    	let dispose;

    	fa0 = new Fa({
    			props: { icon: faCameraRetro },
    			$$inline: true
    		});

    	fa1 = new Fa({
    			props: {
    				icon: faCircleChevronLeft,
    				color: "white"
    			},
    			$$inline: true
    		});

    	fa2 = new Fa({
    			props: {
    				icon: faCircleChevronRight,
    				color: "white"
    			},
    			$$inline: true
    		});

    	let each_value = /*imgs*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div0 = element("div");
    			create_component(fa0.$$.fragment);
    			t0 = text("\n        Snap");
    			t1 = space();
    			div4 = element("div");
    			div2 = element("div");
    			button0 = element("button");
    			create_component(fa1.$$.fragment);
    			t2 = space();
    			button1 = element("button");
    			create_component(fa2.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			img = element("img");
    			t4 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "snap-head svelte-3jp53y");
    			add_location(div0, file$9, 63, 4, 3334);
    			attr_dev(button0, "class", "pre-bnt svelte-3jp53y");
    			add_location(button0, file$9, 69, 12, 3489);
    			attr_dev(button1, "class", "next-bnt svelte-3jp53y");
    			add_location(button1, file$9, 72, 12, 3633);
    			attr_dev(img, "class", "big-image svelte-3jp53y");
    			if (!src_url_equal(img.src, img_src_value = /*imgs*/ ctx[3][/*img_idx*/ ctx[0]])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$9, 76, 16, 3940);
    			attr_dev(div1, "class", "big-image-container");
    			add_render_callback(() => /*div1_elementresize_handler*/ ctx[11].call(div1));
    			add_location(div1, file$9, 75, 12, 3780);
    			attr_dev(div2, "class", "snap-big svelte-3jp53y");
    			add_location(div2, file$9, 68, 8, 3454);
    			attr_dev(div3, "class", "snap-grid svelte-3jp53y");
    			add_location(div3, file$9, 80, 8, 4062);
    			attr_dev(div4, "class", "snap-main svelte-3jp53y");
    			add_location(div4, file$9, 67, 4, 3422);
    			attr_dev(div5, "class", "snap-outline svelte-3jp53y");
    			add_location(div5, file$9, 62, 0, 3303);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div0);
    			mount_component(fa0, div0, null);
    			append_dev(div0, t0);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div2, button0);
    			mount_component(fa1, button0, null);
    			append_dev(div2, t2);
    			append_dev(div2, button1);
    			mount_component(fa2, button1, null);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, img);
    			/*img_binding*/ ctx[10](img);
    			div1_resize_listener = add_resize_listener(div1, /*div1_elementresize_handler*/ ctx[11].bind(div1));
    			append_dev(div4, t4);
    			append_dev(div4, div3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div3, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*pre_image*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*next_image*/ ctx[5], false, false, false),
    					listen_dev(div1, "touchstart", /*swipe_start*/ ctx[7], false, false, false),
    					listen_dev(div1, "touchmove", /*swipe_move*/ ctx[8], false, false, false),
    					listen_dev(div1, "touchend", /*swipe_end*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*img_idx*/ 1 && !src_url_equal(img.src, img_src_value = /*imgs*/ ctx[3][/*img_idx*/ ctx[0]])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*change_image, imgs*/ 72) {
    				each_value = /*imgs*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div3, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa0.$$.fragment, local);
    			transition_in(fa1.$$.fragment, local);
    			transition_in(fa2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa0.$$.fragment, local);
    			transition_out(fa1.$$.fragment, local);
    			transition_out(fa2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(fa0);
    			destroy_component(fa1);
    			destroy_component(fa2);
    			/*img_binding*/ ctx[10](null);
    			div1_resize_listener();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Snap', slots, []);

    	let imgs = [
    		"https://lh3.googleusercontent.com/b9dC_zyDxpidhSMcxG4MPlg5yGgHrxT2JjQl_jnz3XdEsnvUPoh0ZgpJXGMa61miJw6CRghGECvTiheWWdKjdg0bYk7Yh8WDf5rGTI_wbzV0uvsM_MSn2aLHCtOIoYjZSLKaIOtq1Bs=w2400",
    		"https://lh3.googleusercontent.com/wRilQs3DmleP-DjgTjhgZewTWTaifFKS5gAYKu9WCZhseD7Pp83aLOxMkiU5OJLLLcfYdSWB3mNUTQJ34_m44-tgnL1Oz8uu-7MJ_impTZV1jy1P-TZ_O1NHDb9248NPyXuUh8YeC2I=w2400",
    		"https://lh3.googleusercontent.com/twfO9WB1e8YybIA74IJ3ZSNUVTPPGzU3IMASYOXHea8xGZ-Qwr1VaFsaRZwZVzEz1-5XPegZ7QEiNLEJrNAM2qEMyzr0rBA-ARP1MZu6HLebAvLcI8fVQOAHe2N5lu2JpMdSsyYxwCE=w2400",
    		"https://lh3.googleusercontent.com/4oGJObbkPWVj-HhV8qdit7nfbGhyvVp3ttZ9sMSWHBRoVB7K_ShAG3exNx-dtQ7Er4I4n2c3OADQUKPnhMebDUJdXM-lBrdLYB4idZWR9xN1pAzUA9rtB4UdIFhaeed1WnHTUgZYjLc=w2400",
    		"https://lh3.googleusercontent.com/dynQGfMaf7X5umBor9cGjPQ4Sr-x5NsufxmB0WA0h1TVqZ28flLgH1XjX7LYyeTyfQ4m53bARuUrbPv0BlFtzeOt5HCoPyQQqLkjecBpS-f0Qw46LRUb7DrX4ffLXr6enAYgFeYMH8c=w2400",
    		"https://lh3.googleusercontent.com/NedVhB4OaksfNdQEOc9Cp-Q_-RgEOY5AR-fssgWPG0C9Xj4a0aNvwTlIHnCVt4EsH2mF_Uk-5Z9-s0idFmwWq1gh02cB4M6GVIUFRw9wu1d1raKJ_vJllt00RMjduWBRH0Mj5IsJprE=w2400",
    		"https://lh3.googleusercontent.com/8gUTIZZ6M3rmm9DwfFKIWOYyyHp-DjotfSx85d92GKfyrKEovOKhwIChI2fpukJL6s3QEL7tXlTOT0O4C6En0AY_vrE_40agXVgixJBOriX9mRb8OQRkRJoUpxVY2L5M6n58otNhrpI=w2400",
    		"https://lh3.googleusercontent.com/L5bFSXC14yxmVoMOXmiTLYcYjThW7G_zZ3LKHKEAPyl4M8w2YHIhiZCTBmtGOLiNBLODFHdJoEt0sO_Jut652yLnjAQbzHYYw-0QwTiDvzyWA-3ismnH9ojFWYHrRYWareSZPheTmkI=w2400",
    		"https://lh3.googleusercontent.com/Wx3sgucTOCvN4Twgbs6HmR5rQ5nJim1J3WuzgChbwIAeDisK5fo1XqVEj4mKWFRFvzV5LtqRD2oLXVR_wKD9HY7-72SgKUCAVH7zL4o46a5eQzmyGGwKlZnrWzM24uKonc95Xy5qigc=w2400",
    		"https://lh3.googleusercontent.com/dOBQfCZsCj5-6s3FBROPYY-uyvJCxX0W6OKJrOly7lVTPwjaOWiTS_KYxV_6nYffZFy3feBldgsJo4zQtyIGLCQ_JU9XxkJs1jeKvihyaENVuGnjLC-REhqXLjqBqqFW0TMYumb6nck=w2400"
    	];

    	let img_idx = 0;

    	function pre_image() {
    		$$invalidate(0, img_idx--, img_idx);

    		if (img_idx < 0) {
    			$$invalidate(0, img_idx = imgs.length - 1);
    		}
    	}

    	function next_image() {
    		$$invalidate(0, img_idx++, img_idx);

    		if (img_idx == imgs.length) {
    			$$invalidate(0, img_idx = 0);
    		}
    	}

    	function change_image(idx) {
    		$$invalidate(0, img_idx = idx);
    	}

    	let screen_width;
    	let big_image_inner;
    	let start_pos = 0;
    	let offset = 0;
    	let current_pos = 0;

    	function swipe_start(e) {
    		start_pos = e.touches[0].pageX;
    	}

    	function swipe_move(e) {
    		offset = current_pos + (e.targetTouches[0].pageX - start_pos);
    		$$invalidate(2, big_image_inner.style.transform = `translate3d(${offset}px, 0px, 0px)`, big_image_inner);
    		$$invalidate(2, big_image_inner.style.transitionDuration = '0ms', big_image_inner);
    	}

    	function swipe_end(e) {
    		const sum = current_pos + (e.changedTouches[0].pageX - start_pos);
    		let destination = Math.round(sum / screen_width) * screen_width;
    		console.log(destination);

    		if (destination >= 425) {
    			pre_image();
    		} else if (destination <= -425) {
    			next_image();
    		}

    		$$invalidate(2, big_image_inner.style.transform = `translate3d(0px, 0px, 0px)`, big_image_inner);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Snap> was created with unknown prop '${key}'`);
    	});

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			big_image_inner = $$value;
    			$$invalidate(2, big_image_inner);
    		});
    	}

    	function div1_elementresize_handler() {
    		screen_width = this.clientWidth;
    		$$invalidate(1, screen_width);
    	}

    	const click_handler = i => change_image(i);

    	$$self.$capture_state = () => ({
    		Fa,
    		faCameraRetro,
    		faCircleChevronLeft,
    		faCircleChevronRight,
    		imgs,
    		img_idx,
    		pre_image,
    		next_image,
    		change_image,
    		screen_width,
    		big_image_inner,
    		start_pos,
    		offset,
    		current_pos,
    		swipe_start,
    		swipe_move,
    		swipe_end
    	});

    	$$self.$inject_state = $$props => {
    		if ('imgs' in $$props) $$invalidate(3, imgs = $$props.imgs);
    		if ('img_idx' in $$props) $$invalidate(0, img_idx = $$props.img_idx);
    		if ('screen_width' in $$props) $$invalidate(1, screen_width = $$props.screen_width);
    		if ('big_image_inner' in $$props) $$invalidate(2, big_image_inner = $$props.big_image_inner);
    		if ('start_pos' in $$props) start_pos = $$props.start_pos;
    		if ('offset' in $$props) offset = $$props.offset;
    		if ('current_pos' in $$props) current_pos = $$props.current_pos;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		img_idx,
    		screen_width,
    		big_image_inner,
    		imgs,
    		pre_image,
    		next_image,
    		change_image,
    		swipe_start,
    		swipe_move,
    		swipe_end,
    		img_binding,
    		div1_elementresize_handler,
    		click_handler
    	];
    }

    class Snap extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Snap",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/video.svelte generated by Svelte v3.55.1 */
    const file$8 = "src/video.svelte";

    function create_fragment$8(ctx) {
    	let div2;
    	let div0;
    	let fa;
    	let t0;
    	let t1;
    	let div1;
    	let iframe;
    	let iframe_src_value;
    	let current;

    	fa = new Fa({
    			props: { icon: faCirclePlay },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			create_component(fa.$$.fragment);
    			t0 = text("\n        Video");
    			t1 = space();
    			div1 = element("div");
    			iframe = element("iframe");
    			attr_dev(div0, "class", "video-head svelte-1craaja");
    			add_location(div0, file$8, 6, 4, 152);
    			attr_dev(iframe, "title", "");
    			attr_dev(iframe, "width", "425px");
    			attr_dev(iframe, "height", "240px");
    			if (!src_url_equal(iframe.src, iframe_src_value = "https://www.youtube.com/embed/3cCezdU6uk4")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture;");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$8, 11, 8, 274);
    			attr_dev(div1, "class", "video-main");
    			add_location(div1, file$8, 10, 4, 241);
    			attr_dev(div2, "class", "video-outline svelte-1craaja");
    			add_location(div2, file$8, 5, 0, 120);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			mount_component(fa, div0, null);
    			append_dev(div0, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, iframe);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(fa);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Video', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Video> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Fa, faCirclePlay });
    	return [];
    }

    class Video extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Video",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/notiBox.svelte generated by Svelte v3.55.1 */

    const file$7 = "src/notiBox.svelte";

    function create_fragment$7(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let t2;
    	let br0;
    	let t3;
    	let br1;
    	let t4;
    	let br2;
    	let br3;
    	let t5;
    	let br4;
    	let t6;
    	let br5;
    	let t7;
    	let br6;
    	let t8;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "드리고 싶은 말씀";
    			t1 = space();
    			div1 = element("div");
    			t2 = text("코로나19가 장기화되면서\n            ");
    			br0 = element("br");
    			t3 = text("\n            종식을 예측할 수 없어 많은 고민 끝에\n            ");
    			br1 = element("br");
    			t4 = text("\n            결혼식을 예정대로 진행하게 되었습니다.\n            ");
    			br2 = element("br");
    			br3 = element("br");
    			t5 = text("\n            혹여나 청첩장 전달이 누가 되지 않을지\n            ");
    			br4 = element("br");
    			t6 = text("\n            걱정이 많지만 참석이 어려우시더라도\n            ");
    			br5 = element("br");
    			t7 = text("\n            멀리서 축하해주시는 마음\n            ");
    			br6 = element("br");
    			t8 = text("\n            감사히 받겠습니다.");
    			attr_dev(div0, "class", "title svelte-scil8c");
    			add_location(div0, file$7, 6, 8, 91);
    			add_location(br0, file$7, 9, 12, 196);
    			add_location(br1, file$7, 11, 12, 247);
    			add_location(br2, file$7, 13, 12, 298);
    			add_location(br3, file$7, 13, 16, 302);
    			add_location(br4, file$7, 15, 12, 353);
    			add_location(br5, file$7, 17, 12, 402);
    			add_location(br6, file$7, 19, 12, 445);
    			attr_dev(div1, "class", "main-text svelte-scil8c");
    			add_location(div1, file$7, 7, 8, 134);
    			attr_dev(div2, "class", "noti-box svelte-scil8c");
    			add_location(div2, file$7, 5, 4, 60);
    			attr_dev(div3, "class", "noti-box-outline svelte-scil8c");
    			add_location(div3, file$7, 4, 0, 25);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, t2);
    			append_dev(div1, br0);
    			append_dev(div1, t3);
    			append_dev(div1, br1);
    			append_dev(div1, t4);
    			append_dev(div1, br2);
    			append_dev(div1, br3);
    			append_dev(div1, t5);
    			append_dev(div1, br4);
    			append_dev(div1, t6);
    			append_dev(div1, br5);
    			append_dev(div1, t7);
    			append_dev(div1, br6);
    			append_dev(div1, t8);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NotiBox', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<NotiBox> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class NotiBox extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NotiBox",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/guestbook/writing.svelte generated by Svelte v3.55.1 */

    const { console: console_1$2 } = globals;
    const file$6 = "src/guestbook/writing.svelte";

    function create_fragment$6(ctx) {
    	let div6;
    	let button0;
    	let fa;
    	let t0;
    	let div5;
    	let div0;
    	let t2;
    	let div1;
    	let span1;
    	let span0;
    	let t3;
    	let b0;
    	let t5;
    	let input0;
    	let t6;
    	let div2;
    	let span3;
    	let span2;
    	let t7;
    	let b1;
    	let t9;
    	let input1;
    	let t10;
    	let div3;
    	let span5;
    	let span4;
    	let t11;
    	let b2;
    	let t13;
    	let textarea;
    	let t14;
    	let div4;
    	let button1;
    	let t15;
    	let b3;
    	let current;
    	let mounted;
    	let dispose;

    	fa = new Fa({
    			props: {
    				icon: faXmark,
    				size: "0.8x",
    				color: "black"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			button0 = element("button");
    			create_component(fa.$$.fragment);
    			t0 = space();
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "방명록 축하글 작성";
    			t2 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span0 = element("span");
    			t3 = text("이름");
    			b0 = element("b");
    			b0.textContent = "*";
    			t5 = space();
    			input0 = element("input");
    			t6 = space();
    			div2 = element("div");
    			span3 = element("span");
    			span2 = element("span");
    			t7 = text("비밀번호");
    			b1 = element("b");
    			b1.textContent = "*";
    			t9 = space();
    			input1 = element("input");
    			t10 = space();
    			div3 = element("div");
    			span5 = element("span");
    			span4 = element("span");
    			t11 = text("내용");
    			b2 = element("b");
    			b2.textContent = "*";
    			t13 = space();
    			textarea = element("textarea");
    			t14 = space();
    			div4 = element("div");
    			button1 = element("button");
    			t15 = text("신랑 & 신부에게 ");
    			b3 = element("b");
    			b3.textContent = "축하 글 전달하기";
    			attr_dev(button0, "class", "close-bnt svelte-1rntlah");
    			add_location(button0, file$6, 60, 4, 1589);
    			attr_dev(div0, "class", "header svelte-1rntlah");
    			add_location(div0, file$6, 64, 8, 1749);
    			set_style(b0, "color", "red");
    			set_style(b0, "margin-left", "3px");
    			add_location(b0, file$6, 70, 22, 1939);
    			attr_dev(span0, "class", "column-text svelte-1rntlah");
    			add_location(span0, file$6, 69, 16, 1890);
    			attr_dev(span1, "class", "column-title svelte-1rntlah");
    			add_location(span1, file$6, 68, 12, 1846);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "이름을 입력해주세요.");
    			attr_dev(input0, "name", "name");
    			attr_dev(input0, "maxlength", "30");
    			attr_dev(input0, "autocomplete", "off");
    			attr_dev(input0, "class", "svelte-1rntlah");
    			add_location(input0, file$6, 73, 12, 2040);
    			attr_dev(div1, "class", "row svelte-1rntlah");
    			add_location(div1, file$6, 67, 8, 1816);
    			set_style(b1, "color", "red");
    			set_style(b1, "margin-left", "3px");
    			add_location(b1, file$6, 78, 24, 2298);
    			attr_dev(span2, "class", "column-text svelte-1rntlah");
    			add_location(span2, file$6, 77, 16, 2247);
    			attr_dev(span3, "class", "column-title svelte-1rntlah");
    			add_location(span3, file$6, 76, 12, 2203);
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "placeholder", "비밀번호를 입력해주세요.");
    			attr_dev(input1, "name", "password");
    			attr_dev(input1, "maxlength", "30");
    			attr_dev(input1, "autocomplete", "off");
    			attr_dev(input1, "class", "svelte-1rntlah");
    			add_location(input1, file$6, 81, 12, 2399);
    			attr_dev(div2, "class", "row svelte-1rntlah");
    			add_location(div2, file$6, 75, 8, 2173);
    			set_style(b2, "color", "red");
    			set_style(b2, "margin-left", "3px");
    			add_location(b2, file$6, 86, 22, 2669);
    			attr_dev(span4, "class", "column-text svelte-1rntlah");
    			add_location(span4, file$6, 85, 16, 2620);
    			attr_dev(span5, "class", "column-title svelte-1rntlah");
    			add_location(span5, file$6, 84, 12, 2576);
    			attr_dev(textarea, "type", "text");
    			attr_dev(textarea, "placeholder", "내용을 입력해주세요. (최대 100자)");
    			attr_dev(textarea, "name", "content");
    			attr_dev(textarea, "maxlength", "100");
    			attr_dev(textarea, "autocomplete", "off");
    			attr_dev(textarea, "class", "svelte-1rntlah");
    			add_location(textarea, file$6, 89, 12, 2770);
    			attr_dev(div3, "class", "row svelte-1rntlah");
    			add_location(div3, file$6, 83, 8, 2546);
    			add_location(b3, file$6, 93, 26, 3061);
    			attr_dev(button1, "class", "create-writing svelte-1rntlah");
    			add_location(button1, file$6, 92, 12, 2977);
    			set_style(div4, "margin-top", "40px");
    			add_location(div4, file$6, 91, 8, 2934);
    			attr_dev(div5, "class", "writing-main svelte-1rntlah");
    			add_location(div5, file$6, 63, 4, 1714);
    			attr_dev(div6, "class", "writing-outline svelte-1rntlah");
    			set_style(div6, "display", /*display*/ ctx[0]);
    			add_location(div6, file$6, 59, 0, 1528);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, button0);
    			mount_component(fa, button0, null);
    			append_dev(div6, t0);
    			append_dev(div6, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t2);
    			append_dev(div5, div1);
    			append_dev(div1, span1);
    			append_dev(span1, span0);
    			append_dev(span0, t3);
    			append_dev(span0, b0);
    			append_dev(div1, t5);
    			append_dev(div1, input0);
    			set_input_value(input0, /*name*/ ctx[2]);
    			append_dev(div5, t6);
    			append_dev(div5, div2);
    			append_dev(div2, span3);
    			append_dev(span3, span2);
    			append_dev(span2, t7);
    			append_dev(span2, b1);
    			append_dev(div2, t9);
    			append_dev(div2, input1);
    			set_input_value(input1, /*password*/ ctx[3]);
    			append_dev(div5, t10);
    			append_dev(div5, div3);
    			append_dev(div3, span5);
    			append_dev(span5, span4);
    			append_dev(span4, t11);
    			append_dev(span4, b2);
    			append_dev(div3, t13);
    			append_dev(div3, textarea);
    			set_input_value(textarea, /*content*/ ctx[4]);
    			append_dev(div5, t14);
    			append_dev(div5, div4);
    			append_dev(div4, button1);
    			append_dev(button1, t15);
    			append_dev(button1, b3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*change_display*/ ctx[1])) /*change_display*/ ctx[1].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[10]),
    					listen_dev(button1, "click", /*create_comment*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*name*/ 4 && input0.value !== /*name*/ ctx[2]) {
    				set_input_value(input0, /*name*/ ctx[2]);
    			}

    			if (dirty & /*password*/ 8 && input1.value !== /*password*/ ctx[3]) {
    				set_input_value(input1, /*password*/ ctx[3]);
    			}

    			if (dirty & /*content*/ 16) {
    				set_input_value(textarea, /*content*/ ctx[4]);
    			}

    			if (!current || dirty & /*display*/ 1) {
    				set_style(div6, "display", /*display*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_component(fa);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Writing', slots, []);
    	let { display = "none" } = $$props;
    	let { change_display } = $$props;
    	let { backend_url } = $$props;
    	let { swap_to_comment_display } = $$props;
    	let name = "";
    	let password = "";
    	let content = "";

    	async function create_comment() {
    		if (name == "") {
    			alert("이름을 입력해주세요.");
    			return;
    		} else if (password == "") {
    			alert("비밀번호를 입력해주세요.");
    			return;
    		} else if (content == "") {
    			alert("내용을 입력해주세요.");
    			return;
    		}

    		await fetch(backend_url, {
    			method: "POST",
    			headers: { "Content-Type": "application/json" },
    			body: JSON.stringify({ name, password, content })
    		}).then(res => {
    			if (res.status == 200) {
    				return res.json();
    			} else {
    				throw res.status;
    			}
    		}).then(data => {
    			$$invalidate(2, name = "");
    			$$invalidate(3, password = "");
    			$$invalidate(4, content = "");
    			swap_to_comment_display();
    			alert("축하글이 작성되었습니다!");
    		}).catch(error => {
    			console.log("Unexpected error (" + error + ")");
    			alert("현재 축하글을 작성할 수 없습니다.\n잠시 후 이용해주세요.");
    		});
    	}

    	$$self.$$.on_mount.push(function () {
    		if (change_display === undefined && !('change_display' in $$props || $$self.$$.bound[$$self.$$.props['change_display']])) {
    			console_1$2.warn("<Writing> was created without expected prop 'change_display'");
    		}

    		if (backend_url === undefined && !('backend_url' in $$props || $$self.$$.bound[$$self.$$.props['backend_url']])) {
    			console_1$2.warn("<Writing> was created without expected prop 'backend_url'");
    		}

    		if (swap_to_comment_display === undefined && !('swap_to_comment_display' in $$props || $$self.$$.bound[$$self.$$.props['swap_to_comment_display']])) {
    			console_1$2.warn("<Writing> was created without expected prop 'swap_to_comment_display'");
    		}
    	});

    	const writable_props = ['display', 'change_display', 'backend_url', 'swap_to_comment_display'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Writing> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(2, name);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(3, password);
    	}

    	function textarea_input_handler() {
    		content = this.value;
    		$$invalidate(4, content);
    	}

    	$$self.$$set = $$props => {
    		if ('display' in $$props) $$invalidate(0, display = $$props.display);
    		if ('change_display' in $$props) $$invalidate(1, change_display = $$props.change_display);
    		if ('backend_url' in $$props) $$invalidate(6, backend_url = $$props.backend_url);
    		if ('swap_to_comment_display' in $$props) $$invalidate(7, swap_to_comment_display = $$props.swap_to_comment_display);
    	};

    	$$self.$capture_state = () => ({
    		Fa,
    		faXmark,
    		display,
    		change_display,
    		backend_url,
    		swap_to_comment_display,
    		name,
    		password,
    		content,
    		create_comment
    	});

    	$$self.$inject_state = $$props => {
    		if ('display' in $$props) $$invalidate(0, display = $$props.display);
    		if ('change_display' in $$props) $$invalidate(1, change_display = $$props.change_display);
    		if ('backend_url' in $$props) $$invalidate(6, backend_url = $$props.backend_url);
    		if ('swap_to_comment_display' in $$props) $$invalidate(7, swap_to_comment_display = $$props.swap_to_comment_display);
    		if ('name' in $$props) $$invalidate(2, name = $$props.name);
    		if ('password' in $$props) $$invalidate(3, password = $$props.password);
    		if ('content' in $$props) $$invalidate(4, content = $$props.content);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		display,
    		change_display,
    		name,
    		password,
    		content,
    		create_comment,
    		backend_url,
    		swap_to_comment_display,
    		input0_input_handler,
    		input1_input_handler,
    		textarea_input_handler
    	];
    }

    class Writing extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			display: 0,
    			change_display: 1,
    			backend_url: 6,
    			swap_to_comment_display: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Writing",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get display() {
    		throw new Error("<Writing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set display(value) {
    		throw new Error("<Writing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get change_display() {
    		throw new Error("<Writing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set change_display(value) {
    		throw new Error("<Writing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backend_url() {
    		throw new Error("<Writing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backend_url(value) {
    		throw new Error("<Writing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get swap_to_comment_display() {
    		throw new Error("<Writing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set swap_to_comment_display(value) {
    		throw new Error("<Writing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/guestbook/comment.svelte generated by Svelte v3.55.1 */

    const { console: console_1$1 } = globals;
    const file$5 = "src/guestbook/comment.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (88:0) {:catch error}
    function create_catch_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "준비중입니다...";
    			add_location(p, file$5, 88, 8, 2634);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(88:0) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (71:0) {:then comments}
    function create_then_block(ctx) {
    	let ul;
    	let current;
    	let each_value = /*comments*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "padding-zero svelte-6m3od6");
    			add_location(ul, file$5, 71, 8, 1955);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*comments, delete_comment, faSquareMinus*/ 12) {
    				each_value = /*comments*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(71:0) {:then comments}",
    		ctx
    	});

    	return block;
    }

    // (73:4) {#each comments as comment}
    function create_each_block(ctx) {
    	let li;
    	let div0;
    	let span0;
    	let t0_value = /*comment*/ ctx[7].name + "";
    	let t0;
    	let t1;
    	let button;
    	let fa;
    	let button_id_value;
    	let t2;
    	let span1;
    	let t3_value = /*comment*/ ctx[7].created + "";
    	let t3;
    	let t4;
    	let div1;
    	let t5_value = /*comment*/ ctx[7].content + "";
    	let t5;
    	let t6;
    	let current;
    	let mounted;
    	let dispose;

    	fa = new Fa({
    			props: { icon: faSquareMinus, color: "gray" },
    			$$inline: true
    		});

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*comment*/ ctx[7]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			button = element("button");
    			create_component(fa.$$.fragment);
    			t2 = space();
    			span1 = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			div1 = element("div");
    			t5 = text(t5_value);
    			t6 = space();
    			attr_dev(span0, "class", "comment-name svelte-6m3od6");
    			add_location(span0, file$5, 75, 20, 2110);
    			attr_dev(button, "id", button_id_value = /*comment*/ ctx[7].id);
    			attr_dev(button, "class", "delete-bnt svelte-6m3od6");
    			add_location(button, file$5, 76, 20, 2179);
    			attr_dev(span1, "class", "comment-created svelte-6m3od6");
    			add_location(span1, file$5, 79, 20, 2382);
    			attr_dev(div0, "class", "comment-title svelte-6m3od6");
    			add_location(div0, file$5, 74, 16, 2062);
    			attr_dev(div1, "class", "comment-content svelte-6m3od6");
    			add_location(div1, file$5, 81, 16, 2476);
    			attr_dev(li, "class", "comment svelte-6m3od6");
    			add_location(li, file$5, 73, 12, 2025);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t0);
    			append_dev(div0, t1);
    			append_dev(div0, button);
    			mount_component(fa, button, null);
    			append_dev(div0, t2);
    			append_dev(div0, span1);
    			append_dev(span1, t3);
    			append_dev(li, t4);
    			append_dev(li, div1);
    			append_dev(div1, t5);
    			append_dev(li, t6);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*comments*/ 4) && t0_value !== (t0_value = /*comment*/ ctx[7].name + "")) set_data_dev(t0, t0_value);

    			if (!current || dirty & /*comments*/ 4 && button_id_value !== (button_id_value = /*comment*/ ctx[7].id)) {
    				attr_dev(button, "id", button_id_value);
    			}

    			if ((!current || dirty & /*comments*/ 4) && t3_value !== (t3_value = /*comment*/ ctx[7].created + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty & /*comments*/ 4) && t5_value !== (t5_value = /*comment*/ ctx[7].content + "")) set_data_dev(t5, t5_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			destroy_component(fa);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(73:4) {#each comments as comment}",
    		ctx
    	});

    	return block;
    }

    // (69:17)          <p>...Loading</p> {:then comments}
    function create_pending_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "...Loading";
    			add_location(p, file$5, 69, 8, 1912);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(69:17)          <p>...Loading</p> {:then comments}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div2;
    	let button;
    	let fa;
    	let t0;
    	let div1;
    	let div0;
    	let t2;
    	let promise;
    	let current;
    	let mounted;
    	let dispose;

    	fa = new Fa({
    			props: {
    				icon: faXmark,
    				size: ".8x",
    				color: "black"
    			},
    			$$inline: true
    		});

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: true,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 2,
    		error: 10,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*comments*/ ctx[2], info);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			button = element("button");
    			create_component(fa.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "방명록 축하글 전체보기";
    			t2 = space();
    			info.block.c();
    			attr_dev(button, "class", "close-bnt svelte-6m3od6");
    			add_location(button, file$5, 60, 4, 1661);
    			attr_dev(div0, "class", "header svelte-6m3od6");
    			add_location(div0, file$5, 65, 8, 1825);
    			attr_dev(div1, "class", "comment-list svelte-6m3od6");
    			add_location(div1, file$5, 64, 4, 1790);
    			attr_dev(div2, "class", "comment-outline svelte-6m3od6");
    			set_style(div2, "display", /*display*/ ctx[0]);
    			add_location(div2, file$5, 59, 0, 1600);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, button);
    			mount_component(fa, button, null);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t2);
    			info.block.m(div1, info.anchor = null);
    			info.mount = () => div1;
    			info.anchor = null;
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*change_display*/ ctx[1])) /*change_display*/ ctx[1].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*comments*/ 4 && promise !== (promise = /*comments*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}

    			if (!current || dirty & /*display*/ 1) {
    				set_style(div2, "display", /*display*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa.$$.fragment, local);
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa.$$.fragment, local);

    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(fa);
    			info.block.d();
    			info.token = null;
    			info = null;
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let comments;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Comment', slots, []);
    	let { display = "none" } = $$props;
    	let { change_display } = $$props;
    	let { backend_url } = $$props;

    	async function fetch_all_comments() {
    		return await fetch(backend_url).then(res => res.json()).then(data => data.results);
    	}

    	async function delete_comment(comment_id) {
    		let password = prompt("비밀번호를 입력해주세요.");

    		if (password == null || password == "") {
    			return;
    		}

    		await fetch(backend_url, {
    			method: "DELETE",
    			headers: { "Content-Type": "application/json" },
    			body: JSON.stringify({ "id": comment_id, password })
    		}).then(res => {
    			if (res.status == 200) {
    				return res.json();
    			} else {
    				throw res.status;
    			}
    		}).then(data => {
    			alert("삭제되었습니다.");
    			$$invalidate(2, comments = fetch_all_comments());
    		}).catch(status => {
    			if (status == "401") {
    				alert("비밀번호가 틀렸습니다.\n다시 한 번 확인해주세요.");
    			} else {
    				console.log("Unexpected error (" + status + ")");
    				alert("현재 축하글을 삭제할 수 없습니다.\n잠시 후 이용해주세요.");
    			}
    		});
    	}

    	$$self.$$.on_mount.push(function () {
    		if (change_display === undefined && !('change_display' in $$props || $$self.$$.bound[$$self.$$.props['change_display']])) {
    			console_1$1.warn("<Comment> was created without expected prop 'change_display'");
    		}

    		if (backend_url === undefined && !('backend_url' in $$props || $$self.$$.bound[$$self.$$.props['backend_url']])) {
    			console_1$1.warn("<Comment> was created without expected prop 'backend_url'");
    		}
    	});

    	const writable_props = ['display', 'change_display', 'backend_url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Comment> was created with unknown prop '${key}'`);
    	});

    	const click_handler = comment => delete_comment(comment.id);

    	$$self.$$set = $$props => {
    		if ('display' in $$props) $$invalidate(0, display = $$props.display);
    		if ('change_display' in $$props) $$invalidate(1, change_display = $$props.change_display);
    		if ('backend_url' in $$props) $$invalidate(4, backend_url = $$props.backend_url);
    	};

    	$$self.$capture_state = () => ({
    		Fa,
    		faXmark,
    		faSquareMinus,
    		display,
    		change_display,
    		backend_url,
    		fetch_all_comments,
    		delete_comment,
    		comments
    	});

    	$$self.$inject_state = $$props => {
    		if ('display' in $$props) $$invalidate(0, display = $$props.display);
    		if ('change_display' in $$props) $$invalidate(1, change_display = $$props.change_display);
    		if ('backend_url' in $$props) $$invalidate(4, backend_url = $$props.backend_url);
    		if ('comments' in $$props) $$invalidate(2, comments = $$props.comments);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*display*/ 1) {
    			{
    				if (display != "none") {
    					$$invalidate(2, comments = fetch_all_comments());
    				}
    			}
    		}
    	};

    	$$invalidate(2, comments = fetch_all_comments());
    	return [display, change_display, comments, delete_comment, backend_url, click_handler];
    }

    class Comment extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			display: 0,
    			change_display: 1,
    			backend_url: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Comment",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get display() {
    		throw new Error("<Comment>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set display(value) {
    		throw new Error("<Comment>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get change_display() {
    		throw new Error("<Comment>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set change_display(value) {
    		throw new Error("<Comment>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backend_url() {
    		throw new Error("<Comment>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backend_url(value) {
    		throw new Error("<Comment>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/guestbook/guestbook.svelte generated by Svelte v3.55.1 */
    const file$4 = "src/guestbook/guestbook.svelte";

    function create_fragment$4(ctx) {
    	let writing;
    	let t0;
    	let comment;
    	let t1;
    	let div4;
    	let div0;
    	let t3;
    	let div3;
    	let div1;
    	let fa;
    	let t4;
    	let br0;
    	let t5;
    	let br1;
    	let t6;
    	let t7;
    	let div2;
    	let button0;
    	let t9;
    	let button1;
    	let current;
    	let mounted;
    	let dispose;

    	writing = new Writing({
    			props: {
    				display: /*writing_display*/ ctx[0],
    				change_display: /*change_writing_display*/ ctx[2],
    				backend_url,
    				swap_to_comment_display: /*swap_to_comment_display*/ ctx[4]
    			},
    			$$inline: true
    		});

    	comment = new Comment({
    			props: {
    				display: /*comment_display*/ ctx[1],
    				change_display: /*change_comment_display*/ ctx[3],
    				backend_url
    			},
    			$$inline: true
    		});

    	fa = new Fa({
    			props: {
    				icon: faPencil,
    				color: "#f79e9e",
    				style: "margin-bottom: 10px;"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(writing.$$.fragment);
    			t0 = space();
    			create_component(comment.$$.fragment);
    			t1 = space();
    			div4 = element("div");
    			div0 = element("div");
    			div0.textContent = "방명록";
    			t3 = space();
    			div3 = element("div");
    			div1 = element("div");
    			create_component(fa.$$.fragment);
    			t4 = space();
    			br0 = element("br");
    			t5 = text("\n            신랑, 신부에게\n            ");
    			br1 = element("br");
    			t6 = text("\n            축하하는 글을 남겨보세요.");
    			t7 = space();
    			div2 = element("div");
    			button0 = element("button");
    			button0.textContent = "축하글 작성하기";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "방명록 전체보기";
    			attr_dev(div0, "class", "title svelte-13xwa1m");
    			add_location(div0, file$4, 39, 4, 1407);
    			add_location(br0, file$4, 43, 12, 1605);
    			add_location(br1, file$4, 45, 12, 1643);
    			set_style(div1, "padding-bottom", "25px");
    			add_location(div1, file$4, 41, 8, 1477);
    			attr_dev(button0, "class", "writing-guestbook svelte-13xwa1m");
    			add_location(button0, file$4, 49, 12, 1716);
    			attr_dev(button1, "class", "comment-guestbook svelte-13xwa1m");
    			add_location(button1, file$4, 52, 12, 1867);
    			add_location(div2, file$4, 48, 8, 1698);
    			attr_dev(div3, "class", "guestbook-main svelte-13xwa1m");
    			add_location(div3, file$4, 40, 4, 1440);
    			attr_dev(div4, "class", "guestbook-outline svelte-13xwa1m");
    			add_location(div4, file$4, 38, 0, 1371);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(writing, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(comment, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			mount_component(fa, div1, null);
    			append_dev(div1, t4);
    			append_dev(div1, br0);
    			append_dev(div1, t5);
    			append_dev(div1, br1);
    			append_dev(div1, t6);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, button0);
    			append_dev(div2, t9);
    			append_dev(div2, button1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const writing_changes = {};
    			if (dirty & /*writing_display*/ 1) writing_changes.display = /*writing_display*/ ctx[0];
    			writing.$set(writing_changes);
    			const comment_changes = {};
    			if (dirty & /*comment_display*/ 2) comment_changes.display = /*comment_display*/ ctx[1];
    			comment.$set(comment_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(writing.$$.fragment, local);
    			transition_in(comment.$$.fragment, local);
    			transition_in(fa.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(writing.$$.fragment, local);
    			transition_out(comment.$$.fragment, local);
    			transition_out(fa.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(writing, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(comment, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div4);
    			destroy_component(fa);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const backend_url = "https://api.leechohyuntaeryong.com/comments";

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Guestbook', slots, []);
    	let writing_display = "none";
    	let comment_display = "none";
    	let body_overflow_y = "visible";

    	function change_writing_display() {
    		if (writing_display == "none") {
    			$$invalidate(0, writing_display = "block");
    			document.body.style["overflow-y"] = "hidden";
    		} else {
    			$$invalidate(0, writing_display = "none");
    			document.body.style["overflow-y"] = "visible";
    		}
    	}

    	function change_comment_display() {
    		if (comment_display == "none") {
    			$$invalidate(1, comment_display = "block");
    			document.body.style["overflow-y"] = "hidden";
    		} else {
    			$$invalidate(1, comment_display = "none");
    			document.body.style["overflow-y"] = "visible";
    		}
    	}

    	function swap_to_comment_display() {
    		$$invalidate(0, writing_display = "none");
    		$$invalidate(1, comment_display = "block");
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Guestbook> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => change_writing_display();
    	const click_handler_1 = () => change_comment_display();

    	$$self.$capture_state = () => ({
    		Fa,
    		faPencil,
    		Writing,
    		Comment,
    		backend_url,
    		writing_display,
    		comment_display,
    		body_overflow_y,
    		change_writing_display,
    		change_comment_display,
    		swap_to_comment_display
    	});

    	$$self.$inject_state = $$props => {
    		if ('writing_display' in $$props) $$invalidate(0, writing_display = $$props.writing_display);
    		if ('comment_display' in $$props) $$invalidate(1, comment_display = $$props.comment_display);
    		if ('body_overflow_y' in $$props) body_overflow_y = $$props.body_overflow_y;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		writing_display,
    		comment_display,
    		change_writing_display,
    		change_comment_display,
    		swap_to_comment_display,
    		click_handler,
    		click_handler_1
    	];
    }

    class Guestbook extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Guestbook",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/contact.svelte generated by Svelte v3.55.1 */
    const file$3 = "src/contact.svelte";

    function create_fragment$3(ctx) {
    	let div3;
    	let div0;
    	let t1;
    	let div2;
    	let ul0;
    	let li0;
    	let span0;
    	let t3;
    	let span1;
    	let a0;
    	let fa0;
    	let t4;
    	let a1;
    	let fa1;
    	let t5;
    	let li1;
    	let span2;
    	let t7;
    	let span3;
    	let a2;
    	let fa2;
    	let t8;
    	let a3;
    	let fa3;
    	let t9;
    	let div1;
    	let t11;
    	let ul1;
    	let li2;
    	let span4;
    	let t13;
    	let span5;
    	let t15;
    	let span6;
    	let a4;
    	let fa4;
    	let t16;
    	let a5;
    	let fa5;
    	let t17;
    	let span7;
    	let t19;
    	let span8;
    	let a6;
    	let fa6;
    	let t20;
    	let a7;
    	let fa7;
    	let t21;
    	let li3;
    	let span9;
    	let t23;
    	let span10;
    	let t25;
    	let span11;
    	let a8;
    	let fa8;
    	let t26;
    	let a9;
    	let fa9;
    	let t27;
    	let span12;
    	let t29;
    	let span13;
    	let a10;
    	let fa10;
    	let t30;
    	let a11;
    	let fa11;
    	let current;

    	fa0 = new Fa({
    			props: {
    				icon: faPhoneAlt,
    				color: "#78c0e9",
    				flip: "horizontal"
    			},
    			$$inline: true
    		});

    	fa1 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faEnvelope,
    				color: "#444"
    			},
    			$$inline: true
    		});

    	fa2 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faPhoneAlt,
    				color: "#f79e9e",
    				flip: "horizontal"
    			},
    			$$inline: true
    		});

    	fa3 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faEnvelope,
    				color: "#444"
    			},
    			$$inline: true
    		});

    	fa4 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faPhoneAlt,
    				color: "#78c0e9",
    				flip: "horizontal"
    			},
    			$$inline: true
    		});

    	fa5 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faEnvelope,
    				color: "#444"
    			},
    			$$inline: true
    		});

    	fa6 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faPhoneAlt,
    				color: "#78c0e9",
    				flip: "horizontal"
    			},
    			$$inline: true
    		});

    	fa7 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faEnvelope,
    				color: "#444"
    			},
    			$$inline: true
    		});

    	fa8 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faPhoneAlt,
    				color: "#f79e9e",
    				flip: "horizontal"
    			},
    			$$inline: true
    		});

    	fa9 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faEnvelope,
    				color: "#444"
    			},
    			$$inline: true
    		});

    	fa10 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faPhoneAlt,
    				color: "#f79e9e",
    				flip: "horizontal"
    			},
    			$$inline: true
    		});

    	fa11 = new Fa({
    			props: {
    				class: "fa-icon",
    				icon: faEnvelope,
    				color: "#444"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			div0.textContent = "마음 전하실 곳\u001f";
    			t1 = space();
    			div2 = element("div");
    			ul0 = element("ul");
    			li0 = element("li");
    			span0 = element("span");
    			span0.textContent = "신랑에게 연락하기";
    			t3 = space();
    			span1 = element("span");
    			a0 = element("a");
    			create_component(fa0.$$.fragment);
    			t4 = space();
    			a1 = element("a");
    			create_component(fa1.$$.fragment);
    			t5 = space();
    			li1 = element("li");
    			span2 = element("span");
    			span2.textContent = "신부에게 연락하기";
    			t7 = space();
    			span3 = element("span");
    			a2 = element("a");
    			create_component(fa2.$$.fragment);
    			t8 = space();
    			a3 = element("a");
    			create_component(fa3.$$.fragment);
    			t9 = space();
    			div1 = element("div");
    			div1.textContent = "혼주에게 연락하기";
    			t11 = space();
    			ul1 = element("ul");
    			li2 = element("li");
    			span4 = element("span");
    			span4.textContent = "신랑측 혼주";
    			t13 = space();
    			span5 = element("span");
    			span5.textContent = "아버지 현상진";
    			t15 = space();
    			span6 = element("span");
    			a4 = element("a");
    			create_component(fa4.$$.fragment);
    			t16 = space();
    			a5 = element("a");
    			create_component(fa5.$$.fragment);
    			t17 = space();
    			span7 = element("span");
    			span7.textContent = "어머니 김수현";
    			t19 = space();
    			span8 = element("span");
    			a6 = element("a");
    			create_component(fa6.$$.fragment);
    			t20 = space();
    			a7 = element("a");
    			create_component(fa7.$$.fragment);
    			t21 = space();
    			li3 = element("li");
    			span9 = element("span");
    			span9.textContent = "신부측 혼주";
    			t23 = space();
    			span10 = element("span");
    			span10.textContent = "아버지 이택승";
    			t25 = space();
    			span11 = element("span");
    			a8 = element("a");
    			create_component(fa8.$$.fragment);
    			t26 = space();
    			a9 = element("a");
    			create_component(fa9.$$.fragment);
    			t27 = space();
    			span12 = element("span");
    			span12.textContent = "어머니 이순란";
    			t29 = space();
    			span13 = element("span");
    			a10 = element("a");
    			create_component(fa10.$$.fragment);
    			t30 = space();
    			a11 = element("a");
    			create_component(fa11.$$.fragment);
    			attr_dev(div0, "class", "title svelte-k5mc44");
    			add_location(div0, file$3, 6, 4, 164);
    			attr_dev(span0, "class", "contact-block f17 svelte-k5mc44");
    			add_location(span0, file$3, 12, 16, 330);
    			attr_dev(a0, "href", "tel:010-4193-2615");
    			attr_dev(a0, "class", "fa-icon svelte-k5mc44");
    			add_location(a0, file$3, 14, 20, 422);
    			attr_dev(a1, "href", "sms:010-4193-2615");
    			attr_dev(a1, "class", "fa-icon svelte-k5mc44");
    			add_location(a1, file$3, 17, 20, 593);
    			add_location(span1, file$3, 13, 16, 395);
    			attr_dev(li0, "class", "contact-list svelte-k5mc44");
    			add_location(li0, file$3, 11, 12, 288);
    			attr_dev(span2, "class", "contact-block f17 svelte-k5mc44");
    			add_location(span2, file$3, 23, 16, 834);
    			attr_dev(a2, "href", "tel:010-5067-3805");
    			attr_dev(a2, "class", "fa-icon svelte-k5mc44");
    			add_location(a2, file$3, 25, 20, 926);
    			attr_dev(a3, "href", "sms:010-5067-3805");
    			attr_dev(a3, "class", "fa-icon svelte-k5mc44");
    			add_location(a3, file$3, 28, 20, 1113);
    			add_location(span3, file$3, 24, 16, 899);
    			attr_dev(li1, "class", "contact-list svelte-k5mc44");
    			add_location(li1, file$3, 22, 12, 792);
    			attr_dev(ul0, "class", "contact-us svelte-k5mc44");
    			add_location(ul0, file$3, 10, 8, 252);
    			attr_dev(div1, "class", "contact-honju f16 svelte-k5mc44");
    			add_location(div1, file$3, 34, 8, 1323);
    			attr_dev(span4, "class", "honju svelte-k5mc44");
    			set_style(span4, "color", "#78c0e9");
    			add_location(span4, file$3, 39, 16, 1478);
    			attr_dev(span5, "class", "contact-block svelte-k5mc44");
    			add_location(span5, file$3, 40, 16, 1551);
    			attr_dev(a4, "href", "tel:010-4675-2615");
    			attr_dev(a4, "class", "fa-icon svelte-k5mc44");
    			add_location(a4, file$3, 42, 20, 1637);
    			attr_dev(a5, "href", "sms:010-4675-2615");
    			attr_dev(a5, "class", "fa-icon svelte-k5mc44");
    			add_location(a5, file$3, 45, 20, 1824);
    			add_location(span6, file$3, 41, 16, 1610);
    			attr_dev(span7, "class", "contact-block svelte-k5mc44");
    			add_location(span7, file$3, 49, 16, 2010);
    			attr_dev(a6, "href", "tel:010-7538-2605");
    			attr_dev(a6, "class", "fa-icon svelte-k5mc44");
    			add_location(a6, file$3, 51, 20, 2096);
    			attr_dev(a7, "href", "sms:010-7538-2605");
    			attr_dev(a7, "class", "fa-icon svelte-k5mc44");
    			add_location(a7, file$3, 54, 20, 2283);
    			add_location(span8, file$3, 50, 16, 2069);
    			attr_dev(li2, "class", "contact-list svelte-k5mc44");
    			add_location(li2, file$3, 38, 12, 1436);
    			attr_dev(span9, "class", "honju svelte-k5mc44");
    			set_style(span9, "color", "#f79e9e");
    			add_location(span9, file$3, 60, 16, 2525);
    			attr_dev(span10, "class", "contact-block svelte-k5mc44");
    			add_location(span10, file$3, 61, 16, 2598);
    			attr_dev(a8, "href", "tel:010-4020-3804");
    			attr_dev(a8, "class", "fa-icon svelte-k5mc44");
    			add_location(a8, file$3, 63, 20, 2684);
    			attr_dev(a9, "href", "sms:010-4020-3804");
    			attr_dev(a9, "class", "fa-icon svelte-k5mc44");
    			add_location(a9, file$3, 66, 20, 2871);
    			add_location(span11, file$3, 62, 16, 2657);
    			attr_dev(span12, "class", "contact-block svelte-k5mc44");
    			add_location(span12, file$3, 70, 16, 3057);
    			attr_dev(a10, "href", "tel:010-4468-3805");
    			attr_dev(a10, "class", "fa-icon svelte-k5mc44");
    			add_location(a10, file$3, 72, 20, 3143);
    			attr_dev(a11, "href", "sms:010-4468-3805");
    			attr_dev(a11, "class", "fa-icon svelte-k5mc44");
    			add_location(a11, file$3, 75, 20, 3330);
    			add_location(span13, file$3, 71, 16, 3116);
    			attr_dev(li3, "class", "contact-list svelte-k5mc44");
    			add_location(li3, file$3, 59, 12, 2483);
    			attr_dev(ul1, "class", "contact-us svelte-k5mc44");
    			add_location(ul1, file$3, 37, 8, 1400);
    			attr_dev(div2, "class", "contact-main");
    			add_location(div2, file$3, 9, 4, 217);
    			attr_dev(div3, "class", "contact-outline svelte-k5mc44");
    			add_location(div3, file$3, 5, 0, 130);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, ul0);
    			append_dev(ul0, li0);
    			append_dev(li0, span0);
    			append_dev(li0, t3);
    			append_dev(li0, span1);
    			append_dev(span1, a0);
    			mount_component(fa0, a0, null);
    			append_dev(span1, t4);
    			append_dev(span1, a1);
    			mount_component(fa1, a1, null);
    			append_dev(ul0, t5);
    			append_dev(ul0, li1);
    			append_dev(li1, span2);
    			append_dev(li1, t7);
    			append_dev(li1, span3);
    			append_dev(span3, a2);
    			mount_component(fa2, a2, null);
    			append_dev(span3, t8);
    			append_dev(span3, a3);
    			mount_component(fa3, a3, null);
    			append_dev(div2, t9);
    			append_dev(div2, div1);
    			append_dev(div2, t11);
    			append_dev(div2, ul1);
    			append_dev(ul1, li2);
    			append_dev(li2, span4);
    			append_dev(li2, t13);
    			append_dev(li2, span5);
    			append_dev(li2, t15);
    			append_dev(li2, span6);
    			append_dev(span6, a4);
    			mount_component(fa4, a4, null);
    			append_dev(span6, t16);
    			append_dev(span6, a5);
    			mount_component(fa5, a5, null);
    			append_dev(li2, t17);
    			append_dev(li2, span7);
    			append_dev(li2, t19);
    			append_dev(li2, span8);
    			append_dev(span8, a6);
    			mount_component(fa6, a6, null);
    			append_dev(span8, t20);
    			append_dev(span8, a7);
    			mount_component(fa7, a7, null);
    			append_dev(ul1, t21);
    			append_dev(ul1, li3);
    			append_dev(li3, span9);
    			append_dev(li3, t23);
    			append_dev(li3, span10);
    			append_dev(li3, t25);
    			append_dev(li3, span11);
    			append_dev(span11, a8);
    			mount_component(fa8, a8, null);
    			append_dev(span11, t26);
    			append_dev(span11, a9);
    			mount_component(fa9, a9, null);
    			append_dev(li3, t27);
    			append_dev(li3, span12);
    			append_dev(li3, t29);
    			append_dev(li3, span13);
    			append_dev(span13, a10);
    			mount_component(fa10, a10, null);
    			append_dev(span13, t30);
    			append_dev(span13, a11);
    			mount_component(fa11, a11, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(fa0.$$.fragment, local);
    			transition_in(fa1.$$.fragment, local);
    			transition_in(fa2.$$.fragment, local);
    			transition_in(fa3.$$.fragment, local);
    			transition_in(fa4.$$.fragment, local);
    			transition_in(fa5.$$.fragment, local);
    			transition_in(fa6.$$.fragment, local);
    			transition_in(fa7.$$.fragment, local);
    			transition_in(fa8.$$.fragment, local);
    			transition_in(fa9.$$.fragment, local);
    			transition_in(fa10.$$.fragment, local);
    			transition_in(fa11.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(fa0.$$.fragment, local);
    			transition_out(fa1.$$.fragment, local);
    			transition_out(fa2.$$.fragment, local);
    			transition_out(fa3.$$.fragment, local);
    			transition_out(fa4.$$.fragment, local);
    			transition_out(fa5.$$.fragment, local);
    			transition_out(fa6.$$.fragment, local);
    			transition_out(fa7.$$.fragment, local);
    			transition_out(fa8.$$.fragment, local);
    			transition_out(fa9.$$.fragment, local);
    			transition_out(fa10.$$.fragment, local);
    			transition_out(fa11.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(fa0);
    			destroy_component(fa1);
    			destroy_component(fa2);
    			destroy_component(fa3);
    			destroy_component(fa4);
    			destroy_component(fa5);
    			destroy_component(fa6);
    			destroy_component(fa7);
    			destroy_component(fa8);
    			destroy_component(fa9);
    			destroy_component(fa10);
    			destroy_component(fa11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Contact', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Contact> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Fa, faPhoneAlt, faEnvelope });
    	return [];
    }

    class Contact extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Contact",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/bottomImg.svelte generated by Svelte v3.55.1 */

    const file$2 = "src/bottomImg.svelte";

    function create_fragment$2(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let div0;
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text("예쁜 예감이 들었다.\n                ");
    			br0 = element("br");
    			t1 = text("\n                우리는 언제나 손을 잡고 있게 될 것이다.\n                ");
    			br1 = element("br");
    			t2 = text("\n                이이체, 인연");
    			add_location(br0, file$2, 9, 16, 196);
    			add_location(br1, file$2, 11, 16, 257);
    			attr_dev(div0, "class", "bottom-content svelte-1ccxwmz");
    			add_location(div0, file$2, 7, 12, 123);
    			attr_dev(div1, "class", "cover svelte-1ccxwmz");
    			add_location(div1, file$2, 6, 8, 91);
    			attr_dev(div2, "class", "bottom-img svelte-1ccxwmz");
    			add_location(div2, file$2, 5, 4, 58);
    			attr_dev(div3, "class", "bottom-img-outline");
    			add_location(div3, file$2, 4, 0, 21);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, br0);
    			append_dev(div0, t1);
    			append_dev(div0, br1);
    			append_dev(div0, t2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('BottomImg', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<BottomImg> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class BottomImg extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BottomImg",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/share.svelte generated by Svelte v3.55.1 */

    const file$1 = "src/share.svelte";

    function create_fragment$1(ctx) {
    	let div1;
    	let button;
    	let div0;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button = element("button");
    			div0 = element("div");
    			div0.textContent = "카카오톡으로 초대장 보내기";
    			attr_dev(div0, "class", "share-content svelte-1srld98");
    			add_location(div0, file$1, 31, 8, 976);
    			attr_dev(button, "class", "share-kakao svelte-1srld98");
    			add_location(button, file$1, 30, 4, 915);
    			attr_dev(div1, "class", "share-outline");
    			add_location(div1, file$1, 29, 0, 883);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, button);
    			append_dev(button, div0);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", shareMessage, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function shareMessage() {
    	Kakao.Share.sendDefault({
    		objectType: 'feed',
    		content: {
    			title: '4월 22일 현태룡 ♥ 이초현 결혼합니다.',
    			imageUrl: 'https://lh3.googleusercontent.com/rY9Wii-4nEcPrpI1QITGOP7DqBeYg4fy8_53o7zCVWQERI9lcYog2jfYMGaB2txRB1nNkMng430EjxF789JQUwDSGxafXjZxjnC2O-WoOg9fofWIv5LOvmlqfWg8FNMPerEuMhzTM_U=w2400',
    			link: {
    				// [내 애플리케이션] > [플랫폼] 에서 등록한 사이트 도메인과 일치해야 함
    				mobileWebUrl: 'https://bb-worm.github.io/wedding',
    				webUrl: 'https://bb-worm.github.io/wedding'
    			}
    		},
    		buttons: [
    			{
    				title: '모바일청첩장',
    				link: {
    					mobileWebUrl: 'https://bb-worm.github.io/wedding',
    					webUrl: 'https://bb-worm.github.io/wedding'
    				}
    			}
    		]
    	});
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Share', slots, []);
    	Kakao.init("528e6b27db4ad1b8217f3c6a70126fed");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Share> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ shareMessage });
    	return [];
    }

    class Share extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Share",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.55.1 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (50:0) {#if show_guestbook}
    function create_if_block(ctx) {
    	let guestbook;
    	let current;
    	guestbook = new Guestbook({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(guestbook.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(guestbook, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(guestbook.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(guestbook.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(guestbook, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(50:0) {#if show_guestbook}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let audio;
    	let t0;
    	let div;
    	let header;
    	let t1;
    	let mainimg;
    	let t2;
    	let greeting;
    	let t3;
    	let calander;
    	let t4;
    	let snap;
    	let t5;
    	let video;
    	let t6;
    	let notibox;
    	let t7;
    	let t8;
    	let contact;
    	let t9;
    	let bottomimg;
    	let t10;
    	let share;
    	let current;
    	audio = new Audio({ $$inline: true });
    	header = new Header({ $$inline: true });
    	mainimg = new MainImg({ $$inline: true });
    	greeting = new Greeting({ $$inline: true });
    	calander = new Calander({ $$inline: true });
    	snap = new Snap({ $$inline: true });
    	video = new Video({ $$inline: true });
    	notibox = new NotiBox({ $$inline: true });
    	let if_block = /*show_guestbook*/ ctx[0] && create_if_block(ctx);
    	contact = new Contact({ $$inline: true });
    	bottomimg = new BottomImg({ $$inline: true });
    	share = new Share({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(audio.$$.fragment);
    			t0 = space();
    			div = element("div");
    			create_component(header.$$.fragment);
    			t1 = space();
    			create_component(mainimg.$$.fragment);
    			t2 = space();
    			create_component(greeting.$$.fragment);
    			t3 = space();
    			create_component(calander.$$.fragment);
    			t4 = space();
    			create_component(snap.$$.fragment);
    			t5 = space();
    			create_component(video.$$.fragment);
    			t6 = space();
    			create_component(notibox.$$.fragment);
    			t7 = space();
    			if (if_block) if_block.c();
    			t8 = space();
    			create_component(contact.$$.fragment);
    			t9 = space();
    			create_component(bottomimg.$$.fragment);
    			t10 = space();
    			create_component(share.$$.fragment);
    			attr_dev(div, "class", "page-cover svelte-1nibao8");
    			add_location(div, file, 41, 0, 996);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(audio, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(header, div, null);
    			append_dev(div, t1);
    			mount_component(mainimg, div, null);
    			append_dev(div, t2);
    			mount_component(greeting, div, null);
    			append_dev(div, t3);
    			mount_component(calander, div, null);
    			append_dev(div, t4);
    			mount_component(snap, div, null);
    			append_dev(div, t5);
    			mount_component(video, div, null);
    			append_dev(div, t6);
    			mount_component(notibox, div, null);
    			append_dev(div, t7);
    			if (if_block) if_block.m(div, null);
    			append_dev(div, t8);
    			mount_component(contact, div, null);
    			append_dev(div, t9);
    			mount_component(bottomimg, div, null);
    			append_dev(div, t10);
    			mount_component(share, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*show_guestbook*/ ctx[0]) {
    				if (if_block) {
    					if (dirty & /*show_guestbook*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, t8);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(audio.$$.fragment, local);
    			transition_in(header.$$.fragment, local);
    			transition_in(mainimg.$$.fragment, local);
    			transition_in(greeting.$$.fragment, local);
    			transition_in(calander.$$.fragment, local);
    			transition_in(snap.$$.fragment, local);
    			transition_in(video.$$.fragment, local);
    			transition_in(notibox.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(contact.$$.fragment, local);
    			transition_in(bottomimg.$$.fragment, local);
    			transition_in(share.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(audio.$$.fragment, local);
    			transition_out(header.$$.fragment, local);
    			transition_out(mainimg.$$.fragment, local);
    			transition_out(greeting.$$.fragment, local);
    			transition_out(calander.$$.fragment, local);
    			transition_out(snap.$$.fragment, local);
    			transition_out(video.$$.fragment, local);
    			transition_out(notibox.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(contact.$$.fragment, local);
    			transition_out(bottomimg.$$.fragment, local);
    			transition_out(share.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(audio, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			destroy_component(header);
    			destroy_component(mainimg);
    			destroy_component(greeting);
    			destroy_component(calander);
    			destroy_component(snap);
    			destroy_component(video);
    			destroy_component(notibox);
    			if (if_block) if_block.d();
    			destroy_component(contact);
    			destroy_component(bottomimg);
    			destroy_component(share);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    async function health_check() {
    	return await fetch("https://api.leechohyuntaeryong.com").then(res => {
    		return res.status;
    	}).catch(error => {
    		console.log("Unexpected error (" + error + ")");
    		return "500";
    	});
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let show_guestbook = false;

    	onMount(async () => {
    		for (let i = 0; i < 3; i++) {
    			let health_status = await health_check();

    			if (health_status == "200") {
    				$$invalidate(0, show_guestbook = true);
    				return;
    			}
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Audio,
    		Header,
    		MainImg,
    		Greeting,
    		Calander,
    		Snap,
    		Video,
    		NotiBox,
    		Guestbook,
    		Contact,
    		BottomImg,
    		Share,
    		onMount,
    		show_guestbook,
    		health_check
    	});

    	$$self.$inject_state = $$props => {
    		if ('show_guestbook' in $$props) $$invalidate(0, show_guestbook = $$props.show_guestbook);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [show_guestbook];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
