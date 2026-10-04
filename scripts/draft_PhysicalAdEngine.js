"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicalAdEngine = void 0;
exports.parsePTSFromUint8Array = parsePTSFromUint8Array;
exports.resolveAbsoluteUrl = resolveAbsoluteUrl;
var Logger_1 = __importDefault(require("@/utils/Logger"));
/**
 * Parses PTS from the first 8KB of a TS file.
 */
function parsePTSFromUint8Array(u8) {
    if (!u8 || u8.length < 188)
        return null;
    var minPts = null;
    for (var i = 0; i < u8.length - 188; i++) {
        if (u8[i] === 0x47 && u8[i + 188] === 0x47) {
            var pusi = (u8[i + 1] & 0x40) !== 0;
            var afc = (u8[i + 3] >> 4) & 0x03;
            var offset = 4 + (afc === 2 || afc === 3 ? 1 + u8[i + 4] : 0);
            if (pusi && offset + 14 <= 188 && u8[i + offset] === 0 && u8[i + offset + 1] === 0 && u8[i + offset + 2] === 1) {
                var streamId = u8[i + offset + 3];
                if ((streamId >= 0xe0 && streamId <= 0xef) || (streamId >= 0xc0 && streamId <= 0xdf)) {
                    if (u8[i + offset + 7] & 0x80) {
                        var ptsBytes = u8.subarray(i + offset + 9, i + offset + 14);
                        var pts = (((ptsBytes[0] & 0x0e) * Math.pow(2, 29)) + ((ptsBytes[1] & 0xff) << 22) + ((ptsBytes[2] & 0xfe) << 14) + ((ptsBytes[3] & 0xff) << 7) + (ptsBytes[4] >> 1)) / 90000;
                        if (minPts === null || pts < minPts)
                            minPts = pts;
                    }
                }
            }
            i += 187;
        }
    }
    return minPts;
}
function resolveAbsoluteUrl(relativeUrl, baseUrl) {
    if (/^https?:\/\//i.test(relativeUrl))
        return relativeUrl;
    try {
        return new URL(relativeUrl, baseUrl).toString();
    }
    catch (_a) {
        return relativeUrl;
    }
}
var PhysicalAdEngine = /** @class */ (function () {
    function PhysicalAdEngine(blocks, baseUrl) {
        this.ptsCache = new Map();
        this.blocks = [];
        this.logger = Logger_1.default;
        this.blocks = blocks;
        this.baseUrl = baseUrl;
    }
    PhysicalAdEngine.prototype.fetchPTSBatch = function (urls_1) {
        return __awaiter(this, arguments, void 0, function (urls, timeoutMs) {
            var fetchWorker, CONCURRENCY_LIMIT, queue, worker, workers, i;
            var _this = this;
            if (timeoutMs === void 0) { timeoutMs = 2000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fetchWorker = function (u) { return __awaiter(_this, void 0, void 0, function () {
                            var controller_1, tId, res, ab, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 3, , 4]);
                                        controller_1 = new AbortController();
                                        tId = setTimeout(function () { return controller_1.abort(); }, timeoutMs);
                                        return [4 /*yield*/, fetch(u, { signal: controller_1.signal, headers: { Range: 'bytes=0-8191' } })];
                                    case 1:
                                        res = _b.sent();
                                        clearTimeout(tId);
                                        if (!res.ok && res.status !== 206) {
                                            this.ptsCache.set(u, null);
                                            return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, res.arrayBuffer()];
                                    case 2:
                                        ab = _b.sent();
                                        this.ptsCache.set(u, parsePTSFromUint8Array(new Uint8Array(ab)));
                                        return [3 /*break*/, 4];
                                    case 3:
                                        _a = _b.sent();
                                        this.ptsCache.set(u, null);
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); };
                        CONCURRENCY_LIMIT = 4;
                        queue = __spreadArray([], urls, true);
                        worker = function () { return __awaiter(_this, void 0, void 0, function () {
                            var u;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!(queue.length > 0)) return [3 /*break*/, 3];
                                        u = queue.shift();
                                        if (!u) return [3 /*break*/, 2];
                                        return [4 /*yield*/, fetchWorker(u)];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [3 /*break*/, 0];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); };
                        workers = [];
                        for (i = 0; i < Math.min(CONCURRENCY_LIMIT, urls.length); i++) {
                            workers.push(worker());
                        }
                        return [4 /*yield*/, Promise.all(workers)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PhysicalAdEngine.prototype.ensureProbed = function (indices_1) {
        return __awaiter(this, arguments, void 0, function (indices, type) {
            var missing, _i, indices_2, i, b, u;
            if (type === void 0) { type = 'first'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        missing = new Set();
                        for (_i = 0, indices_2 = indices; _i < indices_2.length; _i++) {
                            i = indices_2[_i];
                            if (i < 0 || i >= this.blocks.length)
                                continue;
                            b = this.blocks[i];
                            if (b.urls.length === 0)
                                continue;
                            u = resolveAbsoluteUrl(type === 'first' ? b.urls[0] : b.urls[b.urls.length - 1], this.baseUrl);
                            if (!this.ptsCache.has(u))
                                missing.add(u);
                        }
                        if (!(missing.size > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fetchPTSBatch(Array.from(missing))];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    PhysicalAdEngine.prototype.getCachedPTS = function (i, type) {
        var _a;
        if (type === void 0) { type = 'first'; }
        if (i < 0 || i >= this.blocks.length)
            return null;
        var b = this.blocks[i];
        if (b.urls.length === 0)
            return null;
        var u = resolveAbsoluteUrl(type === 'first' ? b.urls[0] : b.urls[b.urls.length - 1], this.baseUrl);
        return (_a = this.ptsCache.get(u)) !== null && _a !== void 0 ? _a : null;
    };
    PhysicalAdEngine.prototype.detectAds = function () {
        return __awaiter(this, void 0, void 0, function () {
            var n, ads, cum, currentCum, _i, _a, b, STRIDE, TAU, samples, stride, i, isReset, isContAd, expandAd, _b, samples_1, i, anchors, changed, _c, _d, i, _e, _f, j, list, off, refine, _loop_1, k, unverified, _g, _h, i, start, end, p, j, pPrevEnd, prevDur, pNextStart, bridged, j, j;
            var _this = this;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        n = this.blocks.length;
                        ads = new Set();
                        if (n === 0)
                            return [2 /*return*/, ads];
                        cum = [];
                        currentCum = 0;
                        for (_i = 0, _a = this.blocks; _i < _a.length; _i++) {
                            b = _a[_i];
                            cum.push(currentCum);
                            currentCum += b.duration;
                        }
                        STRIDE = 8;
                        TAU = 3.0;
                        samples = [];
                        stride = n <= 16 ? 1 : STRIDE;
                        for (i = 0; i < n; i += stride)
                            samples.push(i);
                        if (samples[samples.length - 1] !== n - 1)
                            samples.push(n - 1);
                        return [4 /*yield*/, this.ensureProbed(samples, 'first')];
                    case 1:
                        _j.sent();
                        isReset = function (i) {
                            var p = _this.getCachedPTS(i);
                            return i > 0 && p !== null && p < 20 && cum[i] - p > 30;
                        };
                        isContAd = function (a, b2) {
                            var pa = _this.getCachedPTS(a);
                            var pb = _this.getCachedPTS(b2);
                            if (pa === null || pb === null)
                                return false;
                            return Math.abs(pb - (pa + _this.blocks[a].duration)) <= 1.0;
                        };
                        expandAd = function (i) { return __awaiter(_this, void 0, void 0, function () {
                            var j, p, j, p;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        ads.add(i);
                                        j = i - 1;
                                        _a.label = 1;
                                    case 1:
                                        if (!(j > 0)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, this.ensureProbed([j], 'first')];
                                    case 2:
                                        _a.sent();
                                        p = this.getCachedPTS(j);
                                        if (p !== null && p < 20 && cum[j] - p > 30 && isContAd(j, j + 1))
                                            ads.add(j);
                                        else
                                            return [3 /*break*/, 4];
                                        _a.label = 3;
                                    case 3:
                                        j--;
                                        return [3 /*break*/, 1];
                                    case 4:
                                        j = i + 1;
                                        _a.label = 5;
                                    case 5:
                                        if (!(j < n)) return [3 /*break*/, 8];
                                        return [4 /*yield*/, this.ensureProbed([j], 'first')];
                                    case 6:
                                        _a.sent();
                                        p = this.getCachedPTS(j);
                                        if (p !== null && p < 20 && cum[j] - p > 30 && isContAd(j - 1, j))
                                            ads.add(j);
                                        else
                                            return [3 /*break*/, 8];
                                        _a.label = 7;
                                    case 7:
                                        j++;
                                        return [3 /*break*/, 5];
                                    case 8: return [2 /*return*/];
                                }
                            });
                        }); };
                        _b = 0, samples_1 = samples;
                        _j.label = 2;
                    case 2:
                        if (!(_b < samples_1.length)) return [3 /*break*/, 5];
                        i = samples_1[_b];
                        if (!isReset(i)) return [3 /*break*/, 4];
                        return [4 /*yield*/, expandAd(i)];
                    case 3:
                        _j.sent();
                        _j.label = 4;
                    case 4:
                        _b++;
                        return [3 /*break*/, 2];
                    case 5:
                        anchors = new Set(samples.filter(function (i) { return !ads.has(i); }));
                        changed = true;
                        _j.label = 6;
                    case 6:
                        if (!changed) return [3 /*break*/, 15];
                        changed = false;
                        _c = 0, _d = Array.from(ads);
                        _j.label = 7;
                    case 7:
                        if (!(_c < _d.length)) return [3 /*break*/, 14];
                        i = _d[_c];
                        _e = 0, _f = [i - 1, i + 1];
                        _j.label = 8;
                    case 8:
                        if (!(_e < _f.length)) return [3 /*break*/, 13];
                        j = _f[_e];
                        if (j < 0 || j >= n || ads.has(j))
                            return [3 /*break*/, 12];
                        return [4 /*yield*/, this.ensureProbed([j], 'first')];
                    case 9:
                        _j.sent();
                        if (!isReset(j)) return [3 /*break*/, 11];
                        return [4 /*yield*/, expandAd(j)];
                    case 10:
                        _j.sent();
                        changed = true;
                        return [3 /*break*/, 12];
                    case 11:
                        anchors.add(j);
                        _j.label = 12;
                    case 12:
                        _e++;
                        return [3 /*break*/, 8];
                    case 13:
                        _c++;
                        return [3 /*break*/, 7];
                    case 14: return [3 /*break*/, 6];
                    case 15:
                        list = Array.from(anchors).filter(function (i) { return !ads.has(i); }).sort(function (x, y) { return x - y; });
                        off = function (i) {
                            var p = _this.getCachedPTS(i);
                            return p !== null ? p - cum[i] : 0; // fallback 0 so diff is 0 if unknown
                        };
                        refine = function (a, b) { return __awaiter(_this, void 0, void 0, function () {
                            var pa, pb, m, inside, lo, hi;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (b - a <= 1)
                                            return [2 /*return*/];
                                        pa = this.getCachedPTS(a);
                                        pb = this.getCachedPTS(b);
                                        if (pa === null || pb === null)
                                            return [2 /*return*/];
                                        if (Math.abs(off(a) - off(b)) <= TAU)
                                            return [2 /*return*/];
                                        m = (a + b) >> 1;
                                        return [4 /*yield*/, this.ensureProbed([m], 'first')];
                                    case 1:
                                        _a.sent();
                                        if (!isReset(m)) return [3 /*break*/, 7];
                                        return [4 /*yield*/, expandAd(m)];
                                    case 2:
                                        _a.sent();
                                        inside = Array.from(ads).filter(function (x) { return x > a && x < b; });
                                        if (!(inside.length > 0)) return [3 /*break*/, 6];
                                        lo = Math.min.apply(Math, inside);
                                        hi = Math.max.apply(Math, inside);
                                        if (!(lo - 1 > a && !ads.has(lo - 1))) return [3 /*break*/, 4];
                                        return [4 /*yield*/, refine(a, lo - 1)];
                                    case 3:
                                        _a.sent();
                                        _a.label = 4;
                                    case 4:
                                        if (!(hi + 1 < b && !ads.has(hi + 1))) return [3 /*break*/, 6];
                                        return [4 /*yield*/, refine(hi + 1, b)];
                                    case 5:
                                        _a.sent();
                                        _a.label = 6;
                                    case 6: return [2 /*return*/];
                                    case 7: return [4 /*yield*/, refine(a, m)];
                                    case 8:
                                        _a.sent();
                                        return [4 /*yield*/, refine(m, b)];
                                    case 9:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        _loop_1 = function (k) {
                            var a, b;
                            return __generator(this, function (_k) {
                                switch (_k.label) {
                                    case 0:
                                        a = list[k], b = list[k + 1];
                                        if (Array.from(ads).some(function (x) { return x > a && x < b; }))
                                            return [2 /*return*/, "continue"];
                                        return [4 /*yield*/, refine(a, b)];
                                    case 1:
                                        _k.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        k = 0;
                        _j.label = 16;
                    case 16:
                        if (!(k + 1 < list.length)) return [3 /*break*/, 19];
                        return [5 /*yield**/, _loop_1(k)];
                    case 17:
                        _j.sent();
                        _j.label = 18;
                    case 18:
                        k++;
                        return [3 /*break*/, 16];
                    case 19:
                        unverified = new Set();
                        _g = 0, _h = Array.from(ads);
                        _j.label = 20;
                    case 20:
                        if (!(_g < _h.length)) return [3 /*break*/, 26];
                        i = _h[_g];
                        if (!(i === n - 1 || (i < n - 1 && !ads.has(i + 1) && i > 0 && !ads.has(i - 1)))) return [3 /*break*/, 25];
                        start = i;
                        while (start > 0 && ads.has(start - 1))
                            start--;
                        end = i;
                        while (end < n - 1 && ads.has(end + 1))
                            end++;
                        if (!(end === n - 1)) return [3 /*break*/, 22];
                        // Tail ad logic: check if PTS in [1.3, 1.6]
                        return [4 /*yield*/, this.ensureProbed([start], 'first')];
                    case 21:
                        // Tail ad logic: check if PTS in [1.3, 1.6]
                        _j.sent();
                        p = this.getCachedPTS(start);
                        if (p === null || p < 1.3 || p > 1.6) {
                            for (j = start; j <= end; j++)
                                unverified.add(j);
                        }
                        return [3 /*break*/, 25];
                    case 22: 
                    // Bridging logic
                    return [4 /*yield*/, this.ensureProbed([start - 1], 'last')];
                    case 23:
                        // Bridging logic
                        _j.sent();
                        return [4 /*yield*/, this.ensureProbed([end + 1], 'first')];
                    case 24:
                        _j.sent();
                        pPrevEnd = this.getCachedPTS(start - 1, 'last');
                        prevDur = this.blocks[start - 1].durs[this.blocks[start - 1].durs.length - 1] || 2.0;
                        pNextStart = this.getCachedPTS(end + 1, 'first');
                        if (pPrevEnd !== null && pNextStart !== null) {
                            bridged = Math.abs(pNextStart - (pPrevEnd + prevDur)) <= TAU;
                            if (!bridged) {
                                for (j = start; j <= end; j++)
                                    unverified.add(j);
                            }
                        }
                        else {
                            for (j = start; j <= end; j++)
                                unverified.add(j);
                        }
                        _j.label = 25;
                    case 25:
                        _g++;
                        return [3 /*break*/, 20];
                    case 26:
                        unverified.forEach(function (x) { return ads.delete(x); });
                        return [2 /*return*/, ads];
                }
            });
        });
    };
    return PhysicalAdEngine;
}());
exports.PhysicalAdEngine = PhysicalAdEngine;
