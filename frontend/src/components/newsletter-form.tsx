"use client";
import { CheckCircle2 } from "lucide-react";
import { FormEvent, useState } from "react";
export function NewsletterForm(){const [done,setDone]=useState(false);function submit(e:FormEvent){e.preventDefault();setDone(true)}return done?<div className="newsletter-done"><CheckCircle2/><span><strong>You’re on the preview list.</strong><small>Preview complete. No information was sent.</small></span></div>:<form onSubmit={submit}><input type="email" placeholder="Enter your email address" aria-label="Email address" required/><button className="button primary" type="submit">Keep me updated</button></form>}
