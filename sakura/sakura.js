/*!
 * Sakura.js 1.1.1
 * Vanilla JS version of jQuery-Sakura: Make it rain sakura petals.
 * https://github.com/jhammann/sakura
 *
 * Copyright 2019-2019 Jeroen Hammann
 *
 * Released under the MIT License
 *
 * Released on: September 4, 2019
 */

"use strict";
var Sakura = function(t, e) {
    var c = this;
    if (void 0 === t) throw new Error("No selector present. Define an element.");
    this.el = document.querySelector(t);
    var a, n;

    function d(t) {
        return t[Math.floor(Math.random() * t.length)]
    }

    function m(t, e) {
        return Math.floor(Math.random() * (e - t + 1)) + t
    }
    this.settings = (a = {
        className: "sakura",
        fallSpeed: 1,
        maxSize: 14,
        minSize: 10,
        delay: 300,
        colors: [{
            gradientColorStart: "rgba(255, 183, 197, 0.9)",
            gradientColorEnd: "rgba(255, 197, 208, 0.9)",
            gradientColorDegree: 120
        }]
    }, n = e, Object.keys(a).forEach(function(t) {
        n && Object.prototype.hasOwnProperty.call(n, t) && (a[t] = n[t])
    }), a), this.el.style.overflowX = "hidden";
    var o = ["webkit", "moz", "MS", "o", ""];

    function u(t, e, a) {
        for (var n = 0; n < o.length; n += 1) {
            var i = e;
            o[n] || (i = e.toLowerCase()), t.addEventListener(o[n] + i, a, !1)
        }
    }

    function h(t) {
        var e = t.getBoundingClientRect();
        return 0 <= e.top && 0 <= e.left && e.bottom <= (window.innerHeight || document.documentElement.clientHeight) && e.right <= (window.innerWidth || document.documentElement.clientWidth)
    }
    this.createPetal = function() {
        c.el.dataset.sakuraAnimId && setTimeout(function() {
            window.requestAnimationFrame(c.createPetal)
        }, c.settings.delay);
        var t = ["sway-0", "sway-1", "sway-2", "sway-3", "sway-4", "sway-5", "sway-6", "sway-7", "sway-8"],
            e = d(["blow-soft-left", "blow-medium-left", "blow-soft-right", "blow-medium-right"]),
            a = d(t),
            n = (.007 * document.documentElement.clientHeight + Math.round(5 * Math.random())) * c.settings.fallSpeed,
            i = ["fall ".concat(n, "s linear 0s 1"), "".concat(e, " ").concat((30 < n ? n : 30) - 20 + m(0, 20), "s linear 0s infinite"), "".concat(a, " ").concat(m(2, 4), "s linear 0s infinite")].join(", "),
            o = document.createElement("div");
        o.classList.add(c.settings.className);
        var r = m(c.settings.minSize, c.settings.maxSize),
            s = r - Math.floor(m(0, c.settings.minSize) / 3),
            l = d(c.settings.colors);
        o.style.background = "linear-gradient(".concat(l.gradientColorDegree, "deg, ").concat(l.gradientColorStart, ", ").concat(l.gradientColorEnd, ")"), o.style.webkitAnimation = i, o.style.animation = i, o.style.borderRadius = "".concat(m(c.settings.maxSize, c.settings.maxSize + Math.floor(10 * Math.random())), "px ").concat(m(1, Math.floor(s / 4)), "px"), o.style.height = "".concat(r, "px"), o.style.left = "".concat(Math.random() * document.documentElement.clientWidth - 100, "px"), o.style.marginTop = "".concat(-(Math.floor(20 * Math.random()) + 15), "px"), o.style.width = "".concat(s, "px"), u(o, "AnimationEnd", function() {
            h(o) || o.remove()
        }), u(o, "AnimationIteration", function() {
            h(o) || o.remove()
        }), c.el.appendChild(o)
    }, this.el.setAttribute("data-sakura-anim-id", window.requestAnimationFrame(this.createPetal))
};
Sakura.prototype.start = function() {
    if (this.el.dataset.sakuraAnimId) throw new Error("Sakura is already running.");
    this.el.setAttribute("data-sakura-anim-id", window.requestAnimationFrame(this.createPetal))
}, Sakura.prototype.stop = function() {
    var e = this,
        t = 0 < arguments.length && void 0 !== arguments[0] && arguments[0],
        a = this.el.dataset.sakuraAnimId;
    a && (window.cancelAnimationFrame(a), this.el.setAttribute("data-sakura-anim-id", "")), t || setTimeout(function() {
        for (var t = document.getElementsByClassName(e.settings.className); 0 < t.length;) t[0].parentNode.removeChild(t[0])
    }, this.settings.delay + 50)
};