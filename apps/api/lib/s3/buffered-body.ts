import { BUFFER_MEMORY_FACTOR, type ReadReservation } from "./read-budget";

const BUFFERED_BODY_SLAB_BYTES = 64 * 1024;
const BUFFERED_BODY_SLAB_OVERHEAD_BYTES = 128;
const SLAB_RESERVATION_BYTES =
   BUFFERED_BODY_SLAB_BYTES * BUFFER_MEMORY_FACTOR +
   BUFFERED_BODY_SLAB_OVERHEAD_BYTES;

const bufferedBodyReservationBytes = (size: number): number =>
   Math.ceil(size / BUFFERED_BODY_SLAB_BYTES) * SLAB_RESERVATION_BYTES;
const bufferedBodyRetainedBytes = (size: number): number =>
   size === 0
      ? 0
      : size * BUFFER_MEMORY_FACTOR + BUFFERED_BODY_SLAB_OVERHEAD_BYTES;

// copy transport views into reserved slabs so tiny chunks cannot pin large backing buffers.
const createBufferedBody = (reservation: ReadReservation) => {
   const slabs: Buffer[] = [];
   let size = 0;
   let result: Buffer | undefined;
   return {
      append(chunk: Uint8Array): void {
         if (result !== undefined)
            throw new Error("Buffered body is already finalized");
         let offset = 0;
         while (offset < chunk.byteLength) {
            const slabOffset = size % BUFFERED_BODY_SLAB_BYTES;
            if (slabOffset === 0) {
               reservation.retain(SLAB_RESERVATION_BYTES);
               slabs.push(Buffer.allocUnsafeSlow(BUFFERED_BODY_SLAB_BYTES));
            }
            const length = Math.min(
               chunk.byteLength - offset,
               BUFFERED_BODY_SLAB_BYTES - slabOffset
            );
            slabs
               .at(-1)!
               .set(chunk.subarray(offset, offset + length), slabOffset);
            offset += length;
            size += length;
         }
      },
      toBuffer(): Buffer {
         if (result !== undefined) return result;
         result = size === 0 ? Buffer.alloc(0) : Buffer.allocUnsafeSlow(size);
         let offset = 0;
         for (const slab of slabs) offset += slab.copy(result, offset);
         slabs.length = 0;
         reservation.discard(
            bufferedBodyReservationBytes(size) - bufferedBodyRetainedBytes(size)
         );
         return result;
      },
   };
};

export {
   BUFFERED_BODY_SLAB_BYTES,
   BUFFERED_BODY_SLAB_OVERHEAD_BYTES,
   bufferedBodyReservationBytes,
   bufferedBodyRetainedBytes,
   createBufferedBody,
};
