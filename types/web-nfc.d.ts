type NDEFRecordData = {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: string | BufferSource;
};

type NDEFMessageInit = {
  records: NDEFRecordData[];
};

type NDEFReadingEvent = Event & {
  serialNumber: string;
  message: {
    records: Array<{
      recordType: string;
      mediaType?: string;
      data?: DataView;
      encoding?: string;
      lang?: string;
    }>;
  };
};

declare class NDEFReader extends EventTarget {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(message: string | NDEFMessageInit): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
}
