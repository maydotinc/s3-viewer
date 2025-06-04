import { zodResolver } from "@hookform/resolvers/zod";
import { signUp } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@s3-viewer/ui/components/form";
import { Input } from "@s3-viewer/ui/components/input";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});
type SignUpFormData = z.infer<typeof formSchema>;

export default function SignUpForm() {
  const router = useRouter();

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    const res = await signUp.email({
      email: data.email,
      password: data.password,
      name: data.name,
    }, {
      onSuccess: () => {
        console.log("Sign up successful");
        router.push("/");
      },
      onError: (error) => {
        console.log("Sign up error", error);
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name<span className="text-xs text-viewerblue">*</span></FormLabel>
              <FormControl>
                <Input placeholder="your-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address<span className="text-xs text-viewerblue">*</span></FormLabel>
              <FormControl>
                <Input placeholder="your-email@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="your-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Register</Button>
      </form>
    </Form>
  );
};