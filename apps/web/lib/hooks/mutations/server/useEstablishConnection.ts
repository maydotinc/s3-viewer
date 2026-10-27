import { ApiError, api } from "@/lib/api";
import { EstablishInput, EstablishResult } from "@s3-viewer/shared";
import { useMutation } from "@tanstack/react-query";

const useEstablishConnection = () =>
   useMutation<EstablishResult, ApiError, EstablishInput>({
      mutationFn: (body) =>
         api.post<EstablishResult>("/servers/establish", body),
   });

export default useEstablishConnection;
