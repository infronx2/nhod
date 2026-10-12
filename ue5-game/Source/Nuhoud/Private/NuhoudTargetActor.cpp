// ============================================================================
// NuhoudTargetActor.cpp
// ============================================================================

#include "NuhoudTargetActor.h"
#include "NuhoudGameMode.h"

#include "Components/StaticMeshComponent.h"
#include "Components/SphereComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"

ANuhoudTargetActor::ANuhoudTargetActor()
{
    PrimaryActorTick.bCanEverTick = true;

    // Collision sphere — detects when the player's hand enters.
    CollisionSphere = CreateDefaultSubobject<USphereComponent>(TEXT("CollisionSphere"));
    CollisionSphere->SetupAttachment(RootComponent);
    CollisionSphere->SetSphereRadius(15.0f);
    CollisionSphere->SetCollisionProfileName(TEXT("OverlapAll"));

    // Visual mesh — a glowing sphere.
    TargetMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TargetMesh"));
    TargetMesh->SetupAttachment(CollisionSphere);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
        TEXT("/Engine/BasicShapes/Sphere.Sphere")
    );
    if (SphereMesh.Succeeded())
    {
        TargetMesh->SetStaticMesh(SphereMesh.Object);
    }

    // Make the target glow (emissive material in Blueprint).
    TargetMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void ANuhoudTargetActor::BeginPlay()
{
    Super::BeginPlay();

    // Set the collision radius from the config.
    CollisionSphere->SetSphereRadius(Radius);
    TargetMesh->SetWorldScale3D(FVector(Radius / 50.0f)); // Scale relative to the default 50cm sphere.

    // Random movement direction for moving targets.
    if (MoveSpeed > 0.0f)
    {
        MoveDirection = FVector(
            FMath::FRandRange(-1.0f, 1.0f),
            FMath::FRandRange(-1.0f, 1.0f),
            FMath::FRandRange(-0.5f, 0.5f)
        ).GetSafeNormal();
    }
}

void ANuhoudTargetActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    // Move the target if MoveSpeed > 0.
    if (MoveSpeed > 0.0f && bActive)
    {
        FVector NewLocation = GetActorLocation() + MoveDirection * MoveSpeed * DeltaSeconds;

        // Bounce within the bounds.
        FVector Origin = GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector;
        for (int32 i = 0; i < 3; i++)
        {
            if (FMath::Abs(NewLocation[i] - Origin[i]) > MoveBounds[i])
            {
                MoveDirection[i] *= -1.0f;
                NewLocation[i] = Origin[i] + FMath::Sign(NewLocation[i] - Origin[i]) * MoveBounds[i];
            }
        }

        SetActorLocation(NewLocation);
    }
}

void ANuhoudTargetActor::OnHit()
{
    if (!bActive)
        return;

    bActive = false;

    // Notify the GameMode.
    if (UWorld* World = GetWorld())
    {
        if (ANuhoudGameMode* GM = Cast<ANuhoudGameMode>(World->GetAuthGameMode()))
        {
            GM->OnTargetHit();
        }
    }

    // Play hit effects (in Blueprint: particles + audio + scale-down animation).
    // Then destroy this actor.
    Destroy();
}
