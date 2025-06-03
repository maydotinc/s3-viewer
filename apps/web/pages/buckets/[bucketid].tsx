import { useRouter } from "next/router";

export default function BucketPage() {
    const router = useRouter();
    const { bucketid } = router.query;

    return (
        <div>
            <h1>Bucket Page for {bucketid}</h1>
        </div>
    )
}