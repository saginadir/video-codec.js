/// <reference path="api.d.ts" />

class Encoder implements IEncoder {
    worker: Worker;

    constructor(worker_script_path: string) {
        this.worker = new Worker(worker_script_path);
    }

    setup(cfg: VideoInfo): Promise<any> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            this.worker.postMessage(cfg);
        });
    }

    encode(frame: VideoFrame): Promise<Packet> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            if (frame.transferable) {
                this.worker.postMessage(frame, [frame.data]);
            } else {
                this.worker.postMessage(frame);
            }
        });
    }
}

class Decoder implements IDecoder {
    worker: Worker;

    constructor(worker_script_path: string) {
        this.worker = new Worker(worker_script_path);
    }

    setup(cfg: Packet): Promise<any> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            this.worker.postMessage(cfg);
        });
    }

    decode(packet: Packet): Promise<VideoFrame> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            this.worker.postMessage(packet, [packet.data]);
        });
    }
}