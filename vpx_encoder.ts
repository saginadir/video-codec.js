/// <reference path="api.d.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _vpx_codec_vp8_cx(): number;
declare function _vpx_codec_vp9_cx(): number;
declare function _vpx_codec_vp10_cx(): number;
declare function _vpx_codec_enc_init2(ctx: number, iface: number, cfg: number, flags: number): number;
declare function _vpx_codec_enc_create_config(iface: number, width: number, height: number,
                                              timebase_num: number, timebase_den: number,
                                              target_bitrate: number): number;
declare function _allocate_vpx_codec_ctx(): number;
declare function _vpx_img_alloc(img: number, fmt: number, width: number, height: number, align: number): number;
declare function _vpx_codec_encode(ctx: number, img: number, pts_lo: number, pts_hi: number, duration: number, flags: number, deadline: number): number;
declare function _vpx_codec_get_cx_data(ctx: number, iter: number): number;
declare function _vpx_codec_error(ctx: number): number;
declare function _vpx_codec_error_detail(ctx: number): number;

class VPXEncoder {
    worker: Worker;
    iface: number;
    ctx: number;
    img: number;
    img_y: Uint8Array;
    img_u: Uint8Array;
    img_v: Uint8Array;
    iter: number;

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data);
        };
    }

    _setup(cfg: VideoInfo) {
        this.iface = _vpx_codec_vp8_cx();
        //this.iface = _vpx_codec_vp9_cx();
        //this.iface = _vpx_codec_vp10_cx();

        var config = _vpx_codec_enc_create_config(this.iface, cfg.width, cfg.height,
                                                  1, 1000, 1000000);
        this.ctx = _allocate_vpx_codec_ctx();
        if (_vpx_codec_enc_init2(this.ctx, this.iface, config, 0)) {
            this.worker.postMessage({status: -1});
            return;
        }

        this.iter = Module._malloc(4);
        this.img = _vpx_img_alloc(0, 0x102 /* VPX_IMG_FMT_I420 */, cfg.width, cfg.height, 1);
        var y_ptr = Module.getValue(this.img + 4 * 9, 'i32');
        var u_ptr = Module.getValue(this.img + 4 * 10, 'i32');
        var v_ptr = Module.getValue(this.img + 4 * 11, 'i32');
        this.img_y = Module.HEAPU8.subarray(y_ptr, y_ptr + cfg.width * cfg.height);
        this.img_u = Module.HEAPU8.subarray(u_ptr, u_ptr + cfg.width * cfg.height / 4);
        this.img_v = Module.HEAPU8.subarray(v_ptr, v_ptr + cfg.width * cfg.height / 4);
        this.worker.onmessage = (e: MessageEvent) => {
            this._encode(e.data);
        };
        this.worker.postMessage({status: 0, data: null});
    }

    _encode(frame: VideoFrame) {
        this.img_y.set(new Uint8Array(frame.y.buffer, frame.y.byteOffset, frame.y.byteLength));
        this.img_u.set(new Uint8Array(frame.u.buffer, frame.u.byteOffset, frame.u.byteLength));
        this.img_v.set(new Uint8Array(frame.v.buffer, frame.v.byteOffset, frame.v.byteLength));
        var pts = Math.floor(frame.timestamp * 1000)|0;
        var ret = _vpx_codec_encode(this.ctx, this.img, pts, 0 /* pts_hi */, 1, 0, 1 /* VPX_DL_REALTIME(1) VPX_DL_GOOD_QUALITY(1000000) */);
        if (ret) {
            this.worker.postMessage({status: -1});
            return;
        }
        Module.setValue(this.iter, 0, 'i32');
        var data = null;
        while ((ret = _vpx_codec_get_cx_data(this.ctx, this.iter)) != 0) {
            if (data) {
                // インタフェース的に未対応...
                this.worker.postMessage({status: -1});
                return;
            }
            var pkt = this._parse_pkt(ret);
            if (pkt.kind == 0 /* VPX_CODEC_CX_FRAME_PKT */) {
                data = new ArrayBuffer(pkt.data.byteLength);
                new Uint8Array(data).set(pkt.data);
            }
        }
        if (data) {
            this.worker.postMessage({
                status: 0,
                data: data,
            }, [data]);
        } else {
            this.worker.postMessage({
                status: 0,
                data: null,
            });
        }
    }

    _parse_pkt(pkt: number): any {
        var kind = Module.getValue(pkt, 'i32');
        var ptr = Module.getValue(pkt + 8, 'i32');
        var bytes = Module.getValue(pkt + 12, 'i32');
        return {
            kind: kind,
            data: Module.HEAPU8.subarray(ptr, ptr + bytes),
        };
    }
}
new VPXEncoder(this);
