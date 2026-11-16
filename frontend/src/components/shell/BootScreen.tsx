/** Full-screen loading state shared by the session gate and the command shell. */
export function BootScreen({message}:{message:string}) {
  return <div className="boot" role="status"><div className="boot-planet" aria-hidden="true"><i/></div><div className="boot-logo" aria-hidden="true">STAR<b>Z</b></div><div className="boot-bar" aria-hidden="true"><i/></div><p>{message}</p></div>;
}
