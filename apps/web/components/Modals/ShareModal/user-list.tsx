import useDeleteRole from "@/lib/hooks/mutations/useDeleteRole";
import useUpdateRole from "@/lib/hooks/mutations/useUpdateRole";
import useServerUsers from "@/lib/hooks/queries/server/useServerUsers";
import useSessionStore from "@/lib/stores/sessionStore";
import { Role } from "@s3-viewer/types";
import { User } from "lucide-react";
import Image from "next/image";
import { useShareContext } from "./context/ShareContext";
import RoleSelector from "./fields/role-input";

const UserList = () => {
   const { serverId } = useShareContext();
   const { serverUsers } = useServerUsers(serverId);
   const userId = useSessionStore((state) => state.userId);
   const users = serverUsers.filter((user) => user.id !== userId);
   const deleteRoleMutation = useDeleteRole();
   const updateRoleMutation = useUpdateRole();

   const handleRoleChange = (userId: string, newRole: Role) => {
      updateRoleMutation.mutate({ serverId, userId, role: newRole });
   };

   const handleRemove = (userId: string, userRole: Role) => {
      deleteRoleMutation.mutate({ serverId, userId, role: userRole });
   };

   if (!users || users.length === 0) {
      return (
         <div className="flex flex-col gap-2 w-full p-2">
            <p className="text-viewerblack text-center text-sm">
               No users have access to this server
            </p>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-2 w-full py-2">
         {users.map((user) => (
            <div
               key={user.id}
               className="flex flex-row w-full items-center justify-between"
            >
               <div className="flex flex-row items-center gap-3">
                  {user?.image ? (
                     <Image
                        src={user.image}
                        alt="Profile"
                        width={40}
                        height={40}
                        className="size-10 rounded-full object-cover min-w-10"
                     />
                  ) : (
                     <User className="size-10 rounded-full bg-blue-400 p-1 min-w-10 text-viewergray" />
                  )}
                  <div className="flex flex-col items-start justify-start">
                     <p className="truncate max-w-[200px] text-black">
                        {user?.name}
                     </p>
                     <p className="text-xs max-w-[200px] truncate text-gray-500">
                        {user?.email}
                     </p>
                  </div>
               </div>
               <div>
                  <RoleSelector
                     disabled={
                        user.role === Role.OWNER ||
                        deleteRoleMutation.isPending ||
                        updateRoleMutation.isPending
                     }
                     value={user.role}
                     onValueChange={(newRole) =>
                        handleRoleChange(user.id, newRole)
                     }
                     mode="manage"
                     className="w-fit hover:bg-gray-50 border-none shadow-none bg-transparent"
                     onRemove={() => handleRemove(user.id, user.role)}
                  />
               </div>
            </div>
         ))}
      </div>
   );
};

export default UserList;
