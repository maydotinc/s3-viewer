const FoldersOnlyLabel = ({ folders }: { folders: readonly string[] }) => (
   <span className="max-w-72 leading-relaxed">
      Folders only: {folders.join(", ")}
   </span>
);

export default FoldersOnlyLabel;
