"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Header } from "../components/header";
import { api } from "../lib/api";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [elasticData, setElasticData] = useState<any>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchElasticData = async () => {
      try {
        const data = await api.getAllDocuments();
        setElasticData(data);
      } catch (error) {
        console.error("Error fetching Elasticsearch data:", error);
      }
    };
    fetchElasticData();
  }, []);

  if (status === "loading") {
    return null; // or a loading spinner
  }

  return (
    <div className="flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <section className="w-full">
          <div className="container mx-auto px-4 flex items-center justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full flex flex-col items-center space-y-8 text-center max-w-3xl">
              <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Welcome to ShareTome
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  Create, share, and search tables with ease.
                </p>
              </div>
              <div className="space-x-4 space-y-4">
                <Button asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="#learn-more">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
