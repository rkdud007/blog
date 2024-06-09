```
#![feature(noop_waker)]

use std::future::Future;
use std::pin::Pin;
use std::task::Waker;

#[derive(Debug)]
enum FooState {
    First,
    Second,
    Final,
}

#[derive(Debug)]
struct Foo {
    state: FooState,
}

impl Foo {
    fn new() -> Self {
        Self {
            state: FooState::First,
        }
    }
}

impl Future for Foo {
    type Output = u32;

    fn poll(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        let pin = self.get_mut();
        match pin.state {
            FooState::First => {
                println!("poll for first time");
                pin.state = FooState::Second;
                std::task::Poll::Pending
            }
            FooState::Second => {
                println!("poll for second time");
                pin.state = FooState::Final;
                std::task::Poll::Pending
            }
            FooState::Final => std::task::Poll::Ready(42),
        }
    }
}

fn main() {
    let mut foo = Foo::new();

    let waker = Waker::noop();
    let mut cx = std::task::Context::from_waker(&waker);

    {
        let foo = Pin::new(&mut foo);
        let a = foo.poll(&mut cx);
        println!("{a:?}");
    }

    {
        let foo = Pin::new(&mut foo);
        let a = foo.poll(&mut cx);
        println!("{a:?}");
    }

    {
        let foo = Pin::new(&mut foo);
        let a = foo.poll(&mut cx);
        println!("{a:?}");
    }
}
```
